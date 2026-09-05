import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { In, LessThan, Repository } from 'typeorm';
import { EstadoPago, EstadoPedido, Pedido } from '../../entities';

/**
 * Los pedidos se crean en estadoPago:'pendiente' ANTES de que el pago se
 * confirme (práctica normal de e-commerce: si el pago falla o el comprador
 * cierra la pestaña a medio pagar, o si es un método que tarda como OXXO, ya
 * existe el pedido al que actualizar el estado más tarde). El problema es que
 * si nunca se paga, ese pedido se queda "pendiente" (o "rechazado" si el
 * comprador lo intentó y Mercado Pago lo rechazó, y nunca reintentó) para
 * siempre, mezclado en el panel del vendedor con pedidos reales. Este job los
 * cancela solo (estado: 'cancelado', marcados con canceladoPorAbandono para
 * distinguirlos de una cancelación manual) pasado PEDIDO_ABANDONO_MINUTOS sin
 * pagarse.
 *
 * TODO(stock): si en algún momento se implementa reserva de inventario por
 * talla/color al crear el pedido, este mismo job es el lugar donde liberar esa
 * reserva — hoy no hay control de stock (ver Producto), así que no aplica.
 */
@Injectable()
export class OrdersCleanupService {
  private readonly logger = new Logger('OrdersCleanupService');

  constructor(
    @InjectRepository(Pedido) private readonly pedidos: Repository<Pedido>,
    private readonly config: ConfigService,
  ) {}

  // '@nestjs/schedule' en esta versión no trae CronExpression.EVERY_15_MINUTES
  // (solo /5, /10, /30) — expresión cron literal para exactamente 15 min.
  @Cron('0 */15 * * * *')
  async cancelarPedidosAbandonados(): Promise<void> {
    const minutos = this.config.get<number>('PEDIDO_ABANDONO_MINUTOS')!;
    const limite = new Date(Date.now() - minutos * 60_000);

    const resultado = await this.pedidos.update(
      {
        estado: EstadoPedido.PENDIENTE,
        estadoPago: In([EstadoPago.PENDIENTE, EstadoPago.RECHAZADO]),
        fecha: LessThan(limite),
      },
      {
        estado: EstadoPedido.CANCELADO,
        canceladoPorAbandono: true,
      },
    );

    const cancelados = resultado.affected ?? 0;
    if (cancelados > 0) {
      this.logger.log(
        `${cancelados} pedido(s) cancelado(s) por abandono (sin pagar tras ${minutos} minutos).`,
      );
    }
  }
}
