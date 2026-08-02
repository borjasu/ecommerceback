import {
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

    const preferencia = await this.preferenceClient.create({
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
      requestOptions: { idempotencyKey: pedido.id },
    });

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

    const pagoCreado = await this.paymentClient.create({
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
      requestOptions: { idempotencyKey: pedido.id },
    });

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

    const pedidoActualizado = await this.verificarYActualizarPorPaymentId(
      String(pagoCreado.id),
    );
    return {
      resultado: aResultadoPago(
        pedidoActualizado?.estadoActualEnMp ?? pagoCreado.status,
      ),
    };
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
    const pagoVerificado = await this.paymentClient.get({
      id: mercadopagoPaymentId,
    });
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
    }
    // rejected/cancelled/pending: EstadoPago no tiene un valor "rechazado" propio
    // (solo pendiente|pagado|reembolsado), así que se deja como pendiente —
    // el módulo vendedor decide manualmente si reintentar o cancelar el pedido.

    return { pedidoId: pedido.id, estadoActualEnMp: pagoVerificado.status };
  }
}
