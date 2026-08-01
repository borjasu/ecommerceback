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
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from 'mercadopago';
import { EstadoPago, Pedido, Usuario } from '../../entities';
import { ProcesarPagoDto } from './dto/procesar-pago.dto';

export type ResultadoPago = 'aprobado' | 'pendiente' | 'rechazado';

export interface RespuestaProcesarPago {
  resultado: ResultadoPago;
}

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

    // transaction_amount SIEMPRE del total ya calculado y guardado en el Pedido
    // (OrdersService ya lo recalculó server-side al crearlo) — nunca un monto que
    // venga del frontend en este endpoint, el DTO ni siquiera tiene ese campo.
    const pagoCreado = await this.paymentClient.create({
      body: {
        transaction_amount: pedido.total,
        token: dto.token,
        installments: dto.installments ?? 1,
        payment_method_id: dto.paymentMethodId,
        external_reference: pedido.numeroPedido,
        description: `Frank Jeans — Pedido ${pedido.numeroPedido}`,
        payer: { email: (await this.emailDelUsuario(usuarioId)) ?? undefined },
      },
      requestOptions: { idempotencyKey: pedido.id },
    });

    if (!pagoCreado.id) {
      throw new BadRequestException('Mercado Pago no devolvió un pago válido.');
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
   * y ambos son idempotentes si el pedido ya estaba pagado.
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

  private async emailDelUsuario(usuarioId: string): Promise<string | null> {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    return usuario?.email ?? null;
  }
}
