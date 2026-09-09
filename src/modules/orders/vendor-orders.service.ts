import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoPago, EstadoPedido, Pedido, PedidoAuditoria } from '../../entities';
import { CambiarEstadoPedidoDto } from './dto/cambiar-estado-pedido.dto';
import { CambiarEstadoPagoDto } from './dto/cambiar-estado-pago.dto';
import { RegistrarEnvioDto } from './dto/registrar-envio.dto';
import { ListarPedidosVendedorQueryDto } from './dto/listar-pedidos-vendedor-query.dto';
import { ShippingService } from '../shipping/shipping.service';

export interface PaginaDePedidos {
  data: Pedido[];
  total: number;
  page: number;
  limit: number;
}

// Máquina de estados simple: qué transiciones puede aplicar el vendedor vía
// PATCH /:id/estado. "enviado" nunca aparece como destino aquí a propósito
// (ver el bloqueo explícito más abajo) — solo se alcanza generando o
// registrando una guía, así infoEnvio nunca queda vacío en un pedido que
// dice estar enviado.
const TRANSICIONES_VALIDAS: Record<EstadoPedido, EstadoPedido[]> = {
  [EstadoPedido.PENDIENTE]: [EstadoPedido.CANCELADO],
  [EstadoPedido.ENVIADO]: [EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO],
  [EstadoPedido.ENTREGADO]: [],
  [EstadoPedido.CANCELADO]: [],
};

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
    @InjectRepository(PedidoAuditoria)
    private readonly auditoria: Repository<PedidoAuditoria>,
    private readonly shippingService: ShippingService,
  ) {}

  async listarTodos(
    query: ListarPedidosVendedorQueryDto,
  ): Promise<PaginaDePedidos> {
    const qb = this.pedidos
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.items', 'items')
      .leftJoinAndSelect('items.producto', 'producto')
      // Mismo patrón que products.service.ts — sin esto, pedidos.component.ts
      // (vendedor) solo tenía item.producto.imagenUrl y caía al placeholder
      // genérico para productos sin imagen general.
      .leftJoinAndSelect('producto.imagenesColores', 'imagenesColores')
      .leftJoinAndSelect('pedido.usuario', 'usuario')
      .orderBy('pedido.fecha', 'DESC');

    // Todo parametrizado vía query builder — nunca concatenación de strings
    // en SQL (mitiga inyección SQL, OWASP A03).
    if (query.estado) {
      qb.andWhere('pedido.estado = :estado', { estado: query.estado });
    }
    if (query.estadoPago) {
      qb.andWhere('pedido.estado_pago = :estadoPago', {
        estadoPago: query.estadoPago,
      });
    }
    if (query.desde) {
      qb.andWhere('pedido.fecha >= :desde', { desde: query.desde });
    }
    if (query.hasta) {
      qb.andWhere('pedido.fecha <= :hasta', { hasta: query.hasta });
    }

    // Por default, la vista principal NUNCA mezcla pedidos cancelados por
    // abandono (nunca se pagaron) con pedidos reales — solo aparecen si se
    // pide explícitamente la pestaña "Abandonados".
    if (query.soloAbandonados) {
      qb.andWhere('pedido.cancelado_por_abandono = true');
    } else {
      qb.andWhere('pedido.cancelado_por_abandono = false');
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();

    return { data, total, page: query.page, limit: query.limit };
  }

  async obtenerUno(id: string): Promise<Pedido> {
    const pedido = await this.pedidos.findOne({
      where: { id },
      relations: {
        items: { producto: { imagenesColores: true } },
        usuario: true,
        auditoria: true,
      },
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

    const pedido = await this.obtenerOFallar(id);
    const permitidas = TRANSICIONES_VALIDAS[pedido.estado] ?? [];
    if (!permitidas.includes(dto.estado)) {
      throw new BadRequestException(
        `No se puede cambiar un pedido de "${pedido.estado}" a "${dto.estado}".`,
      );
    }

    await this.pedidos.update({ id }, { estado: dto.estado });
    return this.obtenerUno(id);
  }

  async actualizarEstadoPago(
    id: string,
    dto: CambiarEstadoPagoDto,
    vendedorId: string,
  ): Promise<Pedido> {
    const pedido = await this.obtenerOFallar(id);

    if (pedido.estadoPago !== dto.estadoPago) {
      await this.pedidos.update({ id }, { estadoPago: dto.estadoPago });
      await this.auditoria.insert({
        pedidoId: id,
        campo: 'estadoPago',
        valorAnterior: pedido.estadoPago,
        valorNuevo: dto.estadoPago,
        usuarioId: vendedorId,
      });
    }

    return this.obtenerUno(id);
  }

  async registrarEnvioManual(
    id: string,
    dto: RegistrarEnvioDto,
  ): Promise<Pedido> {
    const pedido = await this.obtenerOFallar(id);
    this.validarPuedeGenerarGuia(pedido);

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
          // No hay id de envío en Skydropx que consultar (registro manual, no
          // generado vía API) — "created" es el estado inicial razonable hasta
          // que el vendedor lo actualice a mano o llegue un webhook real.
          trackingStatus: 'created',
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
    this.validarPuedeGenerarGuia(pedido);

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

  private validarPuedeGenerarGuia(pedido: Pedido): void {
    // Regla de negocio: nunca se envía (ni se genera una guía real, que
    // cuesta dinero en Skydropx) un pedido sin pago confirmado. Hoy todo pago
    // pasa por Mercado Pago (ver PaymentsService) — si en el futuro se agrega
    // pago contra entrega, ese flujo necesitará su propia excepción explícita
    // aquí (p. ej. por metodoPago), no quitar esta validación por defecto.
    if (pedido.estadoPago !== EstadoPago.PAGADO) {
      throw new BadRequestException(
        'No se puede marcar como enviado un pedido sin pago confirmado.',
      );
    }

    // Idempotencia: si el pedido ya está "enviado", ya tiene guía (por
    // /envio o /generar-guia) — no se genera una segunda, se devuelve un
    // error claro en vez de duplicar.
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
    if (pedido.estado === EstadoPedido.ENTREGADO) {
      throw new BadRequestException(
        'Este pedido ya fue marcado como entregado.',
      );
    }
  }

  private async obtenerOFallar(id: string): Promise<Pedido> {
    const pedido = await this.pedidos.findOne({ where: { id } });
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado.');
    }
    return pedido;
  }
}
