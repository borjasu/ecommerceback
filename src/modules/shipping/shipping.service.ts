import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Direccion, Pedido, Producto } from '../../entities';
import { CotizarEnvioDto } from './dto/cotizar-envio.dto';
import {
  ContactoDireccionSkydropx,
  CotizacionSkydropx,
  DireccionSkydropx,
  ParcelSkydropx,
  SkydropxClientService,
} from './skydropx-client.service';

// TODO(producto): Producto no tiene peso/dimensiones todavía. Mientras ese dato no
// exista en el modelo, se cotiza con un estimado razonable por prenda doblada
// (playera/camisa/pantalón/bermuda de mezclilla o algodón). Cuando se agregue
// peso/dimensiones reales al Producto, sustituir esto por el valor real por línea.
const PESO_KG_POR_PRENDA_DEFAULT = 0.4;
const DIMENSIONES_CM_DEFAULT = { length: 30, width: 25, height: 4 };
const TIEMPO_ESTIMADO_DESCONOCIDO = 'No especificado';

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
}

interface EntradaCache {
  opciones: OpcionEnvio[];
  expiraEn: number;
}

@Injectable()
export class ShippingService {
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

    // TODO(direccion): Direccion no captura "estado" ni "colonia" (area_level1/
    // area_level3) por separado, solo ciudad — Skydropx los exige los tres. Por
    // ahora se reusa `ciudad` como aproximación para ambos; para cotizaciones
    // exactas por colonia, agregar esos campos a la entidad Direccion.
    const destino: DireccionSkydropx = {
      street1: direccion.direccion,
      postal_code: direccion.codigoPostal,
      area_level1: direccion.ciudad,
      area_level2: direccion.ciudad,
      area_level3: direccion.ciudad,
      country_code: 'MX',
    };

    const cotizacion = await this.skydropxClient.obtenerCotizacion(
      origen,
      destino,
      parcel,
    );
    const opciones = this.mapearOpciones(cotizacion);

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
    const destino: DireccionSkydropx = {
      street1: pedido.datosEnvio.direccion,
      postal_code: pedido.datosEnvio.codigoPostal,
      area_level1: pedido.datosEnvio.ciudad,
      area_level2: pedido.datosEnvio.ciudad,
      area_level3: pedido.datosEnvio.ciudad,
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
    };
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
    return cotizacion.rates
      .filter((rate) => rate.success && rate.total != null)
      .map((rate) => ({
        rateId: rate.id,
        paqueteria: rate.provider_display_name,
        servicio: rate.provider_service_name,
        costo: Number(rate.total),
        tiempoEstimado:
          rate.days != null
            ? `${rate.days} día(s)`
            : TIEMPO_ESTIMADO_DESCONOCIDO,
      }));
  }
}
