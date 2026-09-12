import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHmac } from 'crypto';
import { Direccion, Pedido, Producto } from '../../entities';
import { CotizarEnvioDto } from './dto/cotizar-envio.dto';
import {
  ContactoDireccionSkydropx,
  CotizacionSkydropx,
  DireccionSkydropx,
  ParcelSkydropx,
  RateSkydropx,
  SkydropxClientService,
} from './skydropx-client.service';

// TODO(producto): Producto no tiene peso/dimensiones todavía. Mientras ese dato no
// exista en el modelo, se cotiza con un estimado razonable por prenda doblada
// (playera/camisa/pantalón/bermuda de mezclilla o algodón). Cuando se agregue
// peso/dimensiones reales al Producto, sustituir esto por el valor real por línea.
const PESO_KG_POR_PRENDA_DEFAULT = 0.4;
const DIMENSIONES_CM_DEFAULT = { length: 30, width: 25, height: 4 };
const TIEMPO_ESTIMADO_DESCONOCIDO = 'No especificado';

// Detecta, por nombre, la variante de una paquetería que implica que el
// vendedor deja el paquete él mismo (sin que pasen a recogerlo al origen).
// Verificado en vivo contra el sandbox de Skydropx (2026-08-02): el campo
// ESTRUCTURADO `pickup` de la tarifa no distinguió de forma confiable este
// caso concreto (Paquetexpress reportó pickup:false en AMBAS variantes,
// "Nacional" y "Nacional Sin Recolección", pese a que el nombre sí implica
// una diferencia operativa real) — el nombre del servicio es la señal que
// sí funciona para este caso.
const PATRON_SIN_RECOLECCION = /sin\s*recolecci[oó]n/i;

const TTL_CACHE_COTIZACION_MS = 15 * 60 * 1000;

export interface OpcionEnvio {
  rateId: string;
  paqueteria: string;
  servicio: string;
  costo: number;
  tiempoEstimado: string;
}

export interface RespuestaCotizacion {
  cotizacionId: string;
  opciones: OpcionEnvio[];
}

export interface InfoEnvioGenerada {
  paqueteria: string;
  idEnvioSkydropx: string;
  numeroGuia: string | null;
  urlEtiqueta: string | null;
  urlRastreo: string | null;
  trackingStatus: string | null;
}

interface EntradaCache {
  opciones: OpcionEnvio[];
  expiraEn: number;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger('ShippingService');

  // Cache en memoria del proceso. Suficiente para esta etapa (una sola instancia);
  // si el backend llega a correr en varias instancias/réplicas, esto debe moverse
  // a un store compartido (Redis) para que la revalidación funcione sin importar
  // qué instancia atendió la cotización original — Redis no estaba en el stack
  // obligatorio de este prompt, así que se deja como nota explícita, no implementado.
  private readonly cacheCotizaciones = new Map<string, EntradaCache>();

  constructor(
    @InjectRepository(Direccion)
    private readonly direcciones: Repository<Direccion>,
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
    @InjectRepository(Pedido)
    private readonly pedidos: Repository<Pedido>,
    private readonly skydropxClient: SkydropxClientService,
    private readonly config: ConfigService,
  ) {}

  async cotizar(
    usuarioId: string,
    dto: CotizarEnvioDto,
  ): Promise<RespuestaCotizacion> {
    const direccion = await this.direcciones.findOne({
      where: { id: dto.direccionId, usuarioId },
    });
    if (!direccion) {
      throw new NotFoundException('Dirección no encontrada.');
    }

    const productoIds = [...new Set(dto.items.map((item) => item.productoId))];
    const productosEncontrados = await this.productos.find({
      where: { id: In(productoIds) },
    });
    if (productosEncontrados.length !== productoIds.length) {
      throw new NotFoundException(
        'Uno o más productos del carrito ya no existen.',
      );
    }

    const cantidadTotal = dto.items.reduce(
      (total, item) => total + item.cantidad,
      0,
    );
    const parcel: ParcelSkydropx = {
      weight: Number((cantidadTotal * PESO_KG_POR_PRENDA_DEFAULT).toFixed(2)),
      ...DIMENSIONES_CM_DEFAULT,
    };

    const origen = this.origenTienda();

    // Direccion ahora captura calle/colonia/municipio/estado por separado
    // (ver auditoría del prompt de "dirección estructurada + SEPOMEX") — cada
    // area_level va con el dato real en vez de reusar "ciudad" para los tres.
    const destino: DireccionSkydropx = {
      street1: this.formatearCalle(direccion),
      postal_code: direccion.codigoPostal,
      area_level1: direccion.estado,
      area_level2: direccion.municipio,
      area_level3: direccion.colonia,
      country_code: 'MX',
    };

    const cotizacion = await this.skydropxClient.obtenerCotizacion(
      origen,
      destino,
      parcel,
    );
    // Diagnóstico permanente (no un límite artificial): cuántas tarifas
    // regresó Skydropx en crudo vs. cuántas quedaron utilizables después de
    // filtrar por cobertura y colapsar variantes de recolección — para poder
    // distinguir "el sandbox solo tiene N paqueterías para esta ruta" de "el
    // código está recortando el arreglo" sin tener que adivinar.
    this.logger.log(
      `Cotización ${cotizacion.id}: Skydropx devolvió ${cotizacion.rates.length} tarifas en total (${cotizacion.rates.filter((r) => r.success).length} con cobertura).`,
    );
    const opciones = this.mapearOpciones(cotizacion);
    this.logger.log(
      `Cotización ${cotizacion.id}: ${opciones.length} opciones finales tras colapsar variantes de recolección: ${opciones.map((o) => `${o.paqueteria} ${o.servicio}`).join(', ')}`,
    );

    this.cacheCotizaciones.set(cotizacion.id, {
      opciones,
      expiraEn: Date.now() + TTL_CACHE_COTIZACION_MS,
    });

    return { cotizacionId: cotizacion.id, opciones };
  }

  /**
   * Usado por OrdersModule al crear un pedido: nunca confía en el costoEnvio que
   * venga en el body de POST /pedidos. Primero intenta el caché reciente; si no
   * está (expiró o el proceso se reinició), vuelve a consultar a Skydropx en vivo.
   * Si tampoco así se puede confirmar la tarifa, la cotización se considera inválida.
   */
  async revalidar(
    cotizacionId: string,
    rateId: string,
  ): Promise<OpcionEnvio | null> {
    const cacheada = this.cacheCotizaciones.get(cotizacionId);
    if (cacheada && cacheada.expiraEn > Date.now()) {
      return (
        cacheada.opciones.find((opcion) => opcion.rateId === rateId) ?? null
      );
    }

    const cotizacionRemota =
      await this.skydropxClient.obtenerCotizacionPorId(cotizacionId);
    if (!cotizacionRemota) {
      return null;
    }

    const opciones = this.mapearOpciones(cotizacionRemota);
    this.cacheCotizaciones.set(cotizacionId, {
      opciones,
      expiraEn: Date.now() + TTL_CACHE_COTIZACION_MS,
    });
    return opciones.find((opcion) => opcion.rateId === rateId) ?? null;
  }

  /**
   * Usado por el módulo vendedor al marcar un pedido como enviado: cotiza de
   * nuevo (la cotización del checkout original ya expiró para entonces) usando
   * la dirección ya guardada en el pedido, elige la tarifa más parecida al
   * costoEnvio que el cliente ya pagó, y genera la guía real en Skydropx.
   */
  async generarGuia(
    pedido: Pedido,
    emailComprador: string,
  ): Promise<InfoEnvioGenerada> {
    const cantidadTotal = pedido.items.reduce(
      (total, item) => total + item.cantidad,
      0,
    );
    const parcel: ParcelSkydropx = {
      weight: Number((cantidadTotal * PESO_KG_POR_PRENDA_DEFAULT).toFixed(2)),
      ...DIMENSIONES_CM_DEFAULT,
    };

    const origen = this.origenTienda();
    // El desglose estructurado (calle/colonia/municipio/estado) es nullable
    // porque pedidos creados ANTES de esta migración no lo tienen — para
    // esos, único caso donde puede faltar, se cae a los campos legacy
    // (direccion/ciudad) con la misma aproximación que ya se usaba.
    const destino: DireccionSkydropx = {
      street1: pedido.datosEnvio.calle
        ? `${pedido.datosEnvio.calle} ${pedido.datosEnvio.numeroExterior ?? ''}`.trim()
        : pedido.datosEnvio.direccion,
      postal_code: pedido.datosEnvio.codigoPostal,
      area_level1: pedido.datosEnvio.estado ?? pedido.datosEnvio.ciudad,
      area_level2: pedido.datosEnvio.municipio ?? pedido.datosEnvio.ciudad,
      area_level3: pedido.datosEnvio.colonia ?? pedido.datosEnvio.ciudad,
      country_code: 'MX',
    };

    const cotizacion = await this.skydropxClient.obtenerCotizacion(
      origen,
      destino,
      parcel,
    );
    const opciones = this.mapearOpciones(cotizacion);

    if (opciones.length === 0) {
      throw new ServiceUnavailableException(
        'No hay paqueterías con cobertura para esta dirección en este momento.',
      );
    }

    // Ninguna paquetería/tarifa vieja del checkout sigue disponible días después,
    // así que se elige la más cercana en precio a lo que el cliente ya pagó.
    const elegida = opciones.reduce((mejor, actual) =>
      Math.abs(actual.costo - pedido.costoEnvio) <
      Math.abs(mejor.costo - pedido.costoEnvio)
        ? actual
        : mejor,
    );

    const origenContacto: ContactoDireccionSkydropx = {
      ...origen,
      name: this.config.get<string>('STORE_ORIGIN_NAME')!,
      phone: this.config.get<string>('STORE_ORIGIN_PHONE')!,
      email: this.config.get<string>('STORE_ORIGIN_EMAIL')!,
      reference: 'Tienda',
    };
    const destinoContacto: ContactoDireccionSkydropx = {
      ...destino,
      name: pedido.datosEnvio.nombreCompleto,
      phone: pedido.datosEnvio.telefono,
      email: emailComprador,
      reference: 'Domicilio',
    };

    const envio = await this.skydropxClient.crearEnvio(
      cotizacion.id,
      elegida.rateId,
      origenContacto,
      destinoContacto,
    );

    return {
      paqueteria: envio.carrierName,
      idEnvioSkydropx: envio.id,
      numeroGuia: envio.trackingNumber,
      urlEtiqueta: envio.labelUrl,
      urlRastreo: envio.trackingUrlProvider,
      trackingStatus: envio.trackingStatus,
    };
  }

  /**
   * Respaldo de rastreo bajo demanda (GET /pedidos/:id/rastreo): por si el
   * webhook de Skydropx no llega o no está configurado en el sandbox, esto
   * consulta directo contra Skydropx usando el id de envío ya guardado.
   * Devuelve null si el pedido no tiene guía generada o si Skydropx no
   * responde — en ambos casos el llamador debe conservar el estado anterior.
   */
  async consultarRastreo(idEnvioSkydropx: string): Promise<string | null> {
    return this.skydropxClient.obtenerEstadoRastreo(idEnvioSkydropx);
  }

  /**
   * POST /envios/webhook — receptor de eventos de rastreo de Skydropx.
   *
   * OJO, a diferencia del webhook de Mercado Pago (donde la firma HMAC y su
   * formato SÍ están confirmados contra documentación oficial): no encontré
   * documentación de Skydropx PRO confirmada con el mecanismo exacto de firma
   * de este webhook (fuentes distintas se contradicen — una no menciona firma
   * en absoluto, otra habla de HMAC-SHA512 pero para un producto/API distinto
   * de Skydropx). Por eso la validación de firma aquí es OPCIONAL y de mejor
   * esfuerzo: si se configura SKYDROPX_WEBHOOK_SECRET y llega un header de
   * firma, se valida como HMAC-SHA256 del body; si no llega firma o no hay
   * secreto configurado, se procesa igual (es solo texto para mostrar, no una
   * acción sensible como aprobar un pago) pero se registra la advertencia.
   * GET /pedidos/:id/rastreo (consulta bajo demanda) es el respaldo confiable
   * mientras esto no se confirme con un evento real disparado desde el
   * dashboard de Skydropx.
   */
  async procesarWebhookRastreo(
    body: {
      data?: {
        id?: string;
        tracking_number?: string;
        status?: string;
      };
    },
    firmaRecibida: string | undefined,
  ): Promise<void> {
    const secreto = this.config.get<string>('SKYDROPX_WEBHOOK_SECRET');
    if (secreto) {
      if (!firmaRecibida) {
        this.logger.warn(
          'Webhook de Skydropx recibido sin header de firma, con SKYDROPX_WEBHOOK_SECRET configurado — se procesa igual (mecanismo de firma no confirmado oficialmente), pero revisa esto.',
        );
      } else {
        const firmaEsperada = createHmac('sha256', secreto)
          .update(JSON.stringify(body))
          .digest('hex');
        if (firmaRecibida !== firmaEsperada) {
          throw new UnauthorizedException('Firma de webhook inválida.');
        }
      }
    } else {
      this.logger.warn(
        'Webhook de Skydropx recibido sin SKYDROPX_WEBHOOK_SECRET configurado — procesado sin verificar autenticidad.',
      );
    }

    const idEnvio = body.data?.id;
    const trackingNumber = body.data?.tracking_number;
    const nuevoEstado = body.data?.status?.toLowerCase();
    if (!nuevoEstado || (!idEnvio && !trackingNumber)) {
      return;
    }

    const pedido = await this.pedidos.findOne({
      where: idEnvio
        ? { infoEnvio: { idEnvioSkydropx: idEnvio } }
        : { infoEnvio: { numeroGuia: trackingNumber } },
    });
    if (!pedido) {
      this.logger.warn(
        `Webhook de Skydropx: no se encontró pedido para el envío ${idEnvio ?? trackingNumber}.`,
      );
      return;
    }

    await this.pedidos.update(
      { id: pedido.id },
      { infoEnvio: { ...pedido.infoEnvio, trackingStatus: nuevoEstado } },
    );
  }

  private formatearCalle(direccion: Direccion): string {
    return direccion.numeroInterior
      ? `${direccion.calle} ${direccion.numeroExterior} Int. ${direccion.numeroInterior}`
      : `${direccion.calle} ${direccion.numeroExterior}`;
  }

  private origenTienda(): DireccionSkydropx {
    return {
      street1: this.config.get<string>('STORE_ORIGIN_STREET')!,
      postal_code: this.config.get<string>('STORE_ORIGIN_POSTAL_CODE')!,
      area_level1: this.config.get<string>('STORE_ORIGIN_STATE')!,
      area_level2: this.config.get<string>('STORE_ORIGIN_CITY')!,
      area_level3: this.config.get<string>('STORE_ORIGIN_NEIGHBORHOOD')!,
      country_code: this.config.get<string>('STORE_ORIGIN_COUNTRY_CODE')!,
    };
  }

  private mapearOpciones(cotizacion: CotizacionSkydropx): OpcionEnvio[] {
    // Solo las paqueterías con cobertura real para esa ruta (success:true).
    // Las demás (status: no_coverage / not_applicable) no son errores, solo
    // significan que esa paquetería no cubre ese origen-destino.
    const conCobertura = cotizacion.rates.filter(
      (rate) => rate.success && rate.total != null,
    );

    const requierePickup = this.config.get<boolean>('ENVIO_REQUIERE_PICKUP')!;
    const seleccionadas = this.colapsarVariantesDeRecoleccion(
      conCobertura,
      requierePickup,
    );

    return seleccionadas.map((rate) => ({
      rateId: rate.id,
      paqueteria: rate.provider_display_name,
      servicio: rate.provider_service_name,
      costo: Number(rate.total),
      tiempoEstimado:
        rate.days != null ? `${rate.days} día(s)` : TIEMPO_ESTIMADO_DESCONOCIDO,
    }));
  }

  /**
   * Algunas paqueterías (verificado en vivo: Paquetexpress) ofrecen, para la
   * MISMA ruta, dos tarifas que solo difieren en si implican recolección a
   * domicilio en el origen o no ("Nacional" vs "Nacional Sin Recolección") —
   * eso es una decisión de OPERACIÓN fija del vendedor (ENVIO_REQUIERE_PICKUP),
   * nunca algo que el comprador deba elegir como si fuera una opción de envío
   * real distinta. Solo se colapsa cuando una MISMA paquetería realmente
   * ofrece ambas variantes (se agrupa por `provider_display_name`); una
   * paquetería con una sola tarifa (sin ese patrón en el nombre, como
   * Estafeta/DHL/FedEx/J&T en las pruebas contra el sandbox) se deja intacta,
   * para no descartar opciones reales de envío por esta lógica.
   */
  private colapsarVariantesDeRecoleccion(
    rates: RateSkydropx[],
    requierePickup: boolean,
  ): RateSkydropx[] {
    const porPaqueteria = new Map<string, RateSkydropx[]>();
    for (const rate of rates) {
      const grupo = porPaqueteria.get(rate.provider_display_name) ?? [];
      grupo.push(rate);
      porPaqueteria.set(rate.provider_display_name, grupo);
    }

    const resultado: RateSkydropx[] = [];
    for (const grupo of porPaqueteria.values()) {
      const sinRecoleccion = grupo.filter((rate) =>
        PATRON_SIN_RECOLECCION.test(rate.provider_service_name),
      );
      const conRecoleccion = grupo.filter(
        (rate) => !PATRON_SIN_RECOLECCION.test(rate.provider_service_name),
      );

      if (sinRecoleccion.length > 0 && conRecoleccion.length > 0) {
        // Esta paquetería sí ofrece ambas variantes: se queda solo con la
        // que coincide con cómo opera realmente el vendedor.
        resultado.push(...(requierePickup ? conRecoleccion : sinRecoleccion));
      } else {
        // Solo tiene una variante — nada que colapsar, se deja tal cual.
        resultado.push(...grupo);
      }
    }

    return resultado;
  }
}
