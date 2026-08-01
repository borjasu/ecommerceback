import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoPedido, Pedido } from '../../entities';
import { CambiarEstadoPedidoDto } from './dto/cambiar-estado-pedido.dto';
import { CambiarEstadoPagoDto } from './dto/cambiar-estado-pago.dto';
import { RegistrarEnvioDto } from './dto/registrar-envio.dto';
import { ShippingService } from '../shipping/shipping.service';

/**
 * Gestión de pedidos del lado vendedor: a diferencia de OrdersService (que
 * siempre filtra por usuario dueño), aquí el vendedor puede ver y modificar
 * CUALQUIER pedido — es el único vendedor del sistema, no hay noción de
 * "pedidos ajenos" para él, así que no aplica ownership/IDOR aquí.
 */
@Injectable()
export class VendorOrdersService {
  constructor(
    @InjectRepository(Pedido) private readonly pedidos: Repository<Pedido>,
    private readonly shippingService: ShippingService,
  ) {}

  listarTodos(): Promise<Pedido[]> {
    return this.pedidos.find({
      relations: { items: { producto: true }, usuario: true },
      order: { fecha: 'DESC' },
    });
  }

  async obtenerUno(id: string): Promise<Pedido> {
    const pedido = await this.pedidos.findOne({
      where: { id },
      relations: { items: { producto: true }, usuario: true },
    });
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado.');
    }
    return pedido;
  }

  async actualizarEstado(
    id: string,
    dto: CambiarEstadoPedidoDto,
  ): Promise<Pedido> {
    if (dto.estado === EstadoPedido.ENVIADO) {
      // "enviado" solo se alcanza generando una guía (real vía Skydropx en
      // /generar-guia, o manual vía /envio) — así infoEnvio nunca queda vacío
      // en un pedido que dice estar enviado.
      throw new BadRequestException(
        'Para marcar un pedido como enviado, genera o registra la guía de envío primero.',
      );
    }

    await this.obtenerOFallar(id);
    await this.pedidos.update({ id }, { estado: dto.estado });
    return this.obtenerUno(id);
  }

  async actualizarEstadoPago(
    id: string,
    dto: CambiarEstadoPagoDto,
  ): Promise<Pedido> {
    await this.obtenerOFallar(id);
    await this.pedidos.update({ id }, { estadoPago: dto.estadoPago });
    return this.obtenerUno(id);
  }

  async registrarEnvioManual(
    id: string,
    dto: RegistrarEnvioDto,
  ): Promise<Pedido> {
    await this.obtenerOFallar(id);
    await this.pedidos.update(
      { id },
      {
        estado: EstadoPedido.ENVIADO,
        infoEnvio: {
          paqueteria: dto.paqueteria,
          idEnvioSkydropx: null,
          numeroGuia: dto.numeroGuia,
          urlEtiqueta: null,
          urlRastreo: dto.urlRastreo ?? null,
          fechaEnvio: new Date(),
        },
      },
    );
    return this.obtenerUno(id);
  }

  async generarGuiaAutomatica(id: string): Promise<Pedido> {
    const pedido = await this.pedidos.findOne({
      where: { id },
      relations: { items: true, usuario: true },
    });
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado.');
    }
    if (pedido.estado === EstadoPedido.ENVIADO) {
      throw new BadRequestException(
        'Este pedido ya tiene una guía de envío generada.',
      );
    }
    if (pedido.estado === EstadoPedido.CANCELADO) {
      throw new BadRequestException(
        'No se puede generar guía para un pedido cancelado.',
      );
    }

    const infoEnvio = await this.shippingService.generarGuia(
      pedido,
      pedido.usuario.email,
    );

    await this.pedidos.update(
      { id },
      {
        estado: EstadoPedido.ENVIADO,
        infoEnvio: { ...infoEnvio, fechaEnvio: new Date() },
      },
    );

    return this.obtenerUno(id);
  }

  private async obtenerOFallar(id: string): Promise<Pedido> {
    const pedido = await this.pedidos.findOne({ where: { id } });
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado.');
    }
    return pedido;
  }
}
