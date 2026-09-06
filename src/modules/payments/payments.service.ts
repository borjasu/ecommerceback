import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MercadoPagoConfig,
  Payment,
  Preference,
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from 'mercadopago';
import { EstadoPago, Pedido, Usuario } from '../../entities';
import { ProcesarPagoDto } from './dto/procesar-pago.dto';
import { CrearPreferenciaDto } from './dto/crear-preferencia.dto';

export type ResultadoPago = 'aprobado' | 'pendiente' | 'rechazado';

export interface RespuestaProcesarPago {
  resultado: ResultadoPago;
}

export interface RespuestaPreferencia {
  preferenceId: string;
  amount: number;
}

// Margen de tolerancia al comparar montos en punto flotante (centavos).
const TOLERANCIA_MONTO = 0.01;

function aResultadoPago(estadoMercadoPago: string | undefined): ResultadoPago {
  if (estadoMercadoPago === 'approved') {
    return 'aprobado';
  }
  if (estadoMercadoPago === 'rejected' || estadoMercadoPago === 'cancelled') {
    return 'rechazado';
  }
  return 'pendiente';
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('PaymentsService');
  private readonly paymentClient: Payment;
  private readonly preferenceClient: Preference;

  constructor(
    @InjectRepository(Pedido) private readonly pedidos: Repository<Pedido>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly config: ConfigService,
  ) {
    const mpConfig = new MercadoPagoConfig({
      accessToken: this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN')!,
      options: { timeout: 10000 },
    });
    this.paymentClient = new Payment(mpConfig);
    this.preferenceClient = new Preference(mpConfig);
  }

  /**
   * Arma la Preference que inicializa el Payment Brick del frontend (flujo
   * oficial de Checkout Bricks: https://www.mercadopago.com.mx/developers).
   * Todos los unit_price salen de ItemPedido.precioUnitario — el snapshot que
   * OrdersService YA calculó con la oferta vigente aplicada al crear el
   * pedido — nunca se recalculan ni se toma nada del frontend aquí.
   */
  async crearPreferencia(
    usuarioId: string,
    dto: CrearPreferenciaDto,
  ): Promise<RespuestaPreferencia> {
    const pedido = await this.pedidos.findOne({
      // where: {id, usuarioId} en una sola consulta (no "buscar y comparar
      // dueño" después): el pedido de otro usuario da 404, igual que en
      // OrdersService/AddressesService — mitiga IDOR.
      where: { id: dto.pedidoId, usuarioId },
      relations: { items: { producto: true } },
    });
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado.');
    }
    if (pedido.estadoPago === EstadoPago.PAGADO) {
      throw new BadRequestException('Este pedido ya está pagado.');
    }

    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    const frontendUrl = this.config.get<string>('FRONTEND_URL')!;

    let preferencia: Awaited<ReturnType<Preference['create']>>;
    try {
      preferencia = await this.preferenceClient.create({
        body: {
          items: pedido.items.map((item) => ({
            id: item.productoId,
            title: item.producto.nombre,
            quantity: item.cantidad,
            unit_price: item.precioUnitario,
            currency_id: 'MXN',
          })),
          shipments: {
            cost: pedido.costoEnvio,
            mode: 'not_specified',
          },
          payer: {
            name: usuario?.nombre,
            email: usuario?.email,
          },
          // numeroPedido, no pedido.id: es lo que procesarWebhook y
          // verificarYActualizarPorPaymentId ya usan para correlacionar un pago
          // de Mercado Pago con su Pedido — mismo criterio en toda la app.
          external_reference: pedido.numeroPedido,
          back_urls: {
            success: `${frontendUrl}/cuenta/pedidos`,
            pending: `${frontendUrl}/cuenta/pedidos`,
            failure: `${frontendUrl}/checkout`,
          },
          notification_url: `${this.config.get<string>('BACKEND_URL')}/pagos/webhook`,
        },
        // pedido.id tal cual (a diferencia de procesar(), donde la key SÍ
        // varía por intento): esto solo describe la Preference que inicializa
        // el Brick (items/monto), nunca cobra nada, y esos datos no cambian
        // entre reintentos del mismo pedido — no hace falta una key distinta.
        requestOptions: { idempotencyKey: pedido.id },
      });
    } catch (error) {
      this.logger.error(
        `Pedido ${pedido.numeroPedido}: Mercado Pago no pudo crear la preferencia — ${this.describirErrorMp(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadGatewayException(
        'No se pudo iniciar el pago con Mercado Pago. Intenta de nuevo en unos segundos.',
      );
    }

    if (!preferencia.id) {
      this.logger.error(
        `Mercado Pago no devolvió un id de preferencia para el pedido ${pedido.numeroPedido}. Respuesta completa: ${JSON.stringify(preferencia)}`,
      );
      throw new BadRequestException(
        'Mercado Pago no devolvió una preferencia válida.',
      );
    }

    this.logger.log(
      `Preferencia ${preferencia.id} creada para el pedido ${pedido.numeroPedido} (monto: ${pedido.total}).`,
    );

    return { preferenceId: preferencia.id, amount: pedido.total };
  }

  async procesar(
    usuarioId: string,
    dto: ProcesarPagoDto,
  ): Promise<RespuestaProcesarPago> {
    const pedido = await this.pedidos.findOne({
      where: { id: dto.pedidoId, usuarioId },
    });
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    if (pedido.estadoPago === EstadoPago.PAGADO) {
      // Idempotente: si ya está pagado (p. ej. el usuario dio doble clic en "Pagar"),
      // no se vuelve a cobrar ni a llamar a Mercado Pago.
      return { resultado: 'aprobado' };
    }

    // Defensa en profundidad: el Payment Brick ya arma su formData con el
    // `amount` con el que se inicializó (el que ESTE backend le dio en
    // /pagos/crear-preferencia), pero si alguien lo manipula del lado
    // cliente antes de enviarlo, se rechaza aquí ANTES de llamar a Mercado
    // Pago — nunca se le manda a MP un monto que no coincida con el pedido.
    if (Math.abs(dto.transaction_amount - pedido.total) > TOLERANCIA_MONTO) {
      this.logger.warn(
        `Pedido ${pedido.numeroPedido}: transaction_amount del formData (${dto.transaction_amount}) no coincide con el total real (${pedido.total}) — rechazado antes de llamar a Mercado Pago.`,
      );
      throw new BadRequestException(
        'El monto del pago no coincide con el total del pedido.',
      );
    }

    // Log de entrada: qué pedido se va a cobrar y con qué método, ANTES de
    // llamar a Mercado Pago — si la llamada de abajo revienta o el proceso
    // muere a medias, ya queda evidencia de qué se intentó. Nunca se loguea
    // `dto.token` (token de un solo uso que ya tokenizó el Payment Brick en
    // el frontend, equivalente a loguear la tarjeta) ni `dto.payer.identification`
    // (dato personal del comprador) — solo el identificador del pedido y el
    // método elegido, que ya son suficientes para correlacionar en los logs.
    this.logger.log(
      `Pedido ${pedido.numeroPedido}: enviando cobro a Mercado Pago (payment_method_id=${dto.payment_method_id}, installments=${dto.installments ?? 1}).`,
    );

    let pagoCreado: Awaited<ReturnType<Payment['create']>>;
    try {
      pagoCreado = await this.paymentClient.create({
        body: {
          // El propio pedido.total, no dto.transaction_amount — ya se validó
          // arriba que coinciden, pero la fuente de verdad para el cobro real
          // sigue siendo la base de datos, nunca el body del request.
          transaction_amount: pedido.total,
          token: dto.token,
          installments: dto.installments ?? 1,
          payment_method_id: dto.payment_method_id,
          issuer_id: dto.issuer_id ? Number(dto.issuer_id) : undefined,
          external_reference: pedido.numeroPedido,
          description: `Frank Jeans — Pedido ${pedido.numeroPedido}`,
          payer: {
            email: dto.payer.email,
            identification: dto.payer.identification,
            first_name: dto.payer.first_name,
            last_name: dto.payer.last_name,
          },
        },
        // pedido.id + token/payment_method_id, NO solo pedido.id: si el
        // comprador reintenta con otra tarjeta tras un rechazo ("Intentar de
        // nuevo" en checkout.component.ts), esta llamada debe tener una key
        // distinta a la del intento anterior — si no, Mercado Pago la trata
        // como la MISMA solicitud y devolvería el resultado cacheado del
        // primer intento (rechazado) en vez de cobrar la tarjeta nueva. Un
        // reintento genuino con el MISMO token (p. ej. doble submit por un
        // reintento de red del propio navegador) sí conserva la misma key,
        // que es justamente el caso que la idempotencia debe deduplicar.
        requestOptions: {
          idempotencyKey: `${pedido.id}:${dto.token ?? dto.payment_method_id}`,
        },
      });
    } catch (error) {
      // El cliente REST del SDK de Mercado Pago (RestClient.fetch) hace
      // `throw await response.json()` ante cualquier respuesta no-2xx — o sea
      // que la mayoría de estos catches reciben el objeto de error de
      // Mercado Pago tal cual (no una instancia de Error, sin stack), y solo
      // un fallo de red/timeout real (AbortError, fetch failed) sí trae
      // stack. Se loguean ambos casos completos para tener evidencia real la
      // próxima vez que esto pase, en vez de tener que reproducirlo a ciegas.
      this.logger.error(
        `Pedido ${pedido.numeroPedido}: Mercado Pago no pudo procesar el cobro (payment_method_id=${dto.payment_method_id}) — ${this.describirErrorMp(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadGatewayException(
        'No se pudo procesar el pago con Mercado Pago. Intenta de nuevo en unos segundos.',
      );
    }

    if (!pagoCreado.id) {
      throw new BadRequestException('Mercado Pago no devolvió un pago válido.');
    }

    // Log completo de lo que Mercado Pago realmente respondió — para poder
    // diagnosticar un resultado inesperado (p. ej. "pendiente" cuando se
    // esperaba "aprobado") sin adivinar cuál rama del código se ejecutó.
    this.logger.log(
      `Pago ${pagoCreado.id} creado — status=${pagoCreado.status} status_detail=${pagoCreado.status_detail} transaction_amount=${pagoCreado.transaction_amount} (pedido.total=${pedido.total}) payment_method_id=${pagoCreado.payment_method_id}`,
    );

    // Verificación pedida explícitamente además de la de arriba: se confirma
    // también contra lo que Mercado Pago reporta haber registrado en su
    // respuesta — no debería diferir (se lo mandamos nosotros), pero si algo
    // raro pasara, no se marca el pedido como pagado sin esta comprobación.
    if (
      pagoCreado.transaction_amount != null &&
      Math.abs(pagoCreado.transaction_amount - pedido.total) >
        TOLERANCIA_MONTO
    ) {
      this.logger.error(
        `Pago ${pagoCreado.id} de Mercado Pago reporta transaction_amount ${pagoCreado.transaction_amount}, distinto del total real del pedido ${pedido.numeroPedido} (${pedido.total}) — no se marca como pagado.`,
      );
      return { resultado: 'pendiente' };
    }

    try {
      const pedidoActualizado = await this.verificarYActualizarPorPaymentId(
        String(pagoCreado.id),
      );
      return {
        resultado: aResultadoPago(
          pedidoActualizado?.estadoActualEnMp ?? pagoCreado.status,
        ),
      };
    } catch (error) {
      // El pago YA se creó en Mercado Pago (pagoCreado.id existe) — lo que
      // falló es la doble verificación posterior (otra llamada de red a MP)
      // o la escritura en la BD. No hay que devolverle un 500 al comprador
      // por esto: el webhook (mismo método, ver su docstring) es la fuente
      // de verdad definitiva y va a terminar de reflejar el estado real del
      // pedido en cuanto Mercado Pago lo notifique. Se responde 'pendiente'
      // (nunca 'aprobado' sin que la BD realmente lo confirme) para no
      // adelantar al frontend un estado que todavía no se pudo persistir.
      this.logger.error(
        `Pedido ${pedido.numeroPedido}: el pago ${pagoCreado.id} se creó en Mercado Pago (status=${pagoCreado.status}) pero no se pudo verificar/actualizar el pedido después — ${this.describirErrorMp(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return { resultado: 'pendiente' };
    }
  }

  async procesarWebhook(params: {
    xSignature: string | undefined;
    xRequestId: string | undefined;
    dataId: string | undefined;
  }): Promise<void> {
    const { xSignature, xRequestId, dataId } = params;

    try {
      WebhookSignatureValidator.validate({
        xSignature,
        xRequestId,
        dataId,
        secret: this.config.get<string>('MERCADOPAGO_WEBHOOK_SECRET')!,
        // Ventana corta: además de validar la firma, limita ataques de repetición
        // (replay) con una notificación vieja capturada y reenviada más tarde.
        toleranceSeconds: 300,
      });
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        this.logger.warn(
          `Webhook de Mercado Pago rechazado: ${error.reason} (request-id: ${error.requestId})`,
        );
        throw new UnauthorizedException('Firma de webhook inválida.');
      }
      throw error;
    }

    if (!dataId) {
      throw new BadRequestException('Falta data.id en la notificación.');
    }

    // No confiamos en el payload del webhook por sí solo (podría estar bien
    // firmado pero seguir sin reflejar el estado real más reciente): siempre se
    // vuelve a consultar el pago completo contra la API de Mercado Pago con su id.
    await this.verificarYActualizarPorPaymentId(dataId);
  }

  /**
   * Único punto de escritura de estadoPago en todo el módulo. Tanto el flujo
   * síncrono (POST /pagos/procesar) como el webhook pasan por aquí — ambos
   * vuelven a consultar el pago real contra Mercado Pago antes de tocar la BD,
   * y ambos son idempotentes si el pedido ya estaba pagado. Esta es también
   * la fuente de verdad DEFINITIVA para pagos que tardan en confirmarse
   * (ticket/OXXO puede tardar días): /procesar da la respuesta inmediata,
   * pero el webhook -vía este mismo método- es el que termina de confirmar.
   */
  private async verificarYActualizarPorPaymentId(
    mercadopagoPaymentId: string,
  ): Promise<{
    pedidoId: string;
    estadoActualEnMp: string | undefined;
  } | null> {
    let pagoVerificado: Awaited<ReturnType<Payment['get']>>;
    try {
      pagoVerificado = await this.paymentClient.get({
        id: mercadopagoPaymentId,
      });
    } catch (error) {
      // Se loguea aquí (con el paymentId a mano, antes de saber a qué pedido
      // corresponde) y se vuelve a lanzar tal cual: quien llama a este método
      // decide qué hacer con el fallo. El webhook (procesarWebhook) debe
      // dejarlo propagar sin capturarlo — un 500 de vuelta a Mercado Pago es
      // lo que hace que su sistema reintente la notificación más tarde; si se
      // lo tragara aquí, Mercado Pago daría por entregado un webhook que en
      // realidad nunca actualizó el pedido.
      this.logger.error(
        `No se pudo verificar el pago ${mercadopagoPaymentId} contra la API de Mercado Pago — ${this.describirErrorMp(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
    const numeroPedido = pagoVerificado.external_reference;

    if (!numeroPedido) {
      this.logger.warn(
        `Pago ${mercadopagoPaymentId} de Mercado Pago sin external_reference — no se puede correlacionar.`,
      );
      return null;
    }

    const pedido = await this.pedidos.findOne({ where: { numeroPedido } });
    if (!pedido) {
      this.logger.warn(
        `Pago ${mercadopagoPaymentId} referencia el pedido ${numeroPedido}, que no existe.`,
      );
      return null;
    }

    if (pedido.estadoPago === EstadoPago.PAGADO) {
      return { pedidoId: pedido.id, estadoActualEnMp: pagoVerificado.status };
    }

    if (pagoVerificado.status === 'approved') {
      await this.pedidos.update(
        { id: pedido.id },
        { estadoPago: EstadoPago.PAGADO },
      );
    } else if (
      pagoVerificado.status === 'rejected' ||
      pagoVerificado.status === 'cancelled'
    ) {
      // Explícito y distinto de PENDIENTE: el comprador sí intentó pagar y
      // Mercado Pago lo rechazó, no es que todavía no pague (p. ej. un
      // ticket OXXO en espera). No es un estado terminal — un pedido
      // RECHAZADO puede volver a pasar por aquí y terminar en PAGADO si el
      // comprador reintenta con otro método/tarjeta (ver
      // checkout.component.ts del frontend, botón "Intentar de nuevo").
      await this.pedidos.update(
        { id: pedido.id },
        { estadoPago: EstadoPago.RECHAZADO },
      );
    }
    // pending: se deja como PENDIENTE (default) — sigue esperando
    // confirmación (p. ej. ticket OXXO todavía no pagado).

    return { pedidoId: pedido.id, estadoActualEnMp: pagoVerificado.status };
  }

  /**
   * Normaliza cualquier error que puedan lanzar `paymentClient.create`/`.get`
   * a un string logueable. El SDK de Mercado Pago (RestClient.fetch, ver
   * mercadopago/dist/utils/restClient) hace `throw await response.json()`
   * ante cualquier respuesta no-2xx — el objeto que llega aquí normalmente
   * NO es una instancia de Error (no tiene `.stack`), sino el body de error
   * de Mercado Pago tal cual (`{ message, error, status, cause }`). Un fallo
   * real de red/timeout (AbortError, "fetch failed") sí es un Error. Nunca
   * incluye datos de tarjeta: Mercado Pago no los devuelve en sus respuestas
   * de error, la tokenización ya ocurrió en el frontend.
   */
  private describirErrorMp(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
