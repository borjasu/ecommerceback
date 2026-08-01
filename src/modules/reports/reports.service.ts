import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EstadoPago,
  EstadoPedido,
  ItemPedido,
  Pedido,
  Producto,
} from '../../entities';
import { ReportesQueryDto } from './dto/reportes-query.dto';

const DIAS_PERIODO_DEFAULT = 30;
const LIMITE_PEDIDOS_RECIENTES = 5;
const LIMITE_PRODUCTOS_MAS_VENDIDOS = 10;

export interface ResumenDashboard {
  totalProductos: number;
  totalPedidos: number;
  pedidosPendientes: number;
  ingresosTotales: number;
  pedidosRecientes: Pedido[];
}

export interface PuntoVenta {
  etiqueta: string;
  total: number;
}

export interface ProductoMasVendido {
  productoId: string;
  nombre: string;
  cantidad: number;
  ingresos: number;
}

export interface ResumenReportes {
  ingresosTotales: number;
  totalPedidos: number;
  ticketPromedio: number;
  serieVentas: PuntoVenta[];
  productosMasVendidos: ProductoMasVendido[];
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
    @InjectRepository(Pedido) private readonly pedidos: Repository<Pedido>,
    @InjectRepository(ItemPedido)
    private readonly itemsPedido: Repository<ItemPedido>,
  ) {}

  async dashboard(): Promise<ResumenDashboard> {
    const [
      totalProductos,
      totalPedidos,
      pedidosPendientes,
      pedidosRecientes,
      { suma },
    ] = await Promise.all([
      this.productos.count(),
      this.pedidos.count(),
      this.pedidos.count({ where: { estado: EstadoPedido.PENDIENTE } }),
      this.pedidos.find({
        order: { fecha: 'DESC' },
        take: LIMITE_PEDIDOS_RECIENTES,
      }),
      this.pedidos
        .createQueryBuilder('pedido')
        .select('COALESCE(SUM(pedido.total), 0)', 'suma')
        .where('pedido.estado_pago = :pagado', { pagado: EstadoPago.PAGADO })
        .getRawOne<{ suma: string }>()
        .then((fila) => ({ suma: fila?.suma ?? '0' })),
    ]);

    return {
      totalProductos,
      totalPedidos,
      pedidosPendientes,
      ingresosTotales: Number(suma),
      pedidosRecientes,
    };
  }

  async reportes(query: ReportesQueryDto): Promise<ResumenReportes> {
    const hasta = query.hasta ? new Date(query.hasta) : new Date();
    const desde = query.desde
      ? new Date(query.desde)
      : this.restarDias(hasta, DIAS_PERIODO_DEFAULT);
    const granularidad = query.granularidad ?? 'dia';

    const pedidosEnPeriodo = await this.pedidos
      .createQueryBuilder('pedido')
      .where('pedido.fecha BETWEEN :desde AND :hasta', { desde, hasta })
      .andWhere('pedido.estado_pago = :pagado', { pagado: EstadoPago.PAGADO })
      .getMany();

    const ingresosTotales =
      Math.round(
        pedidosEnPeriodo.reduce((total, pedido) => total + pedido.total, 0) *
          100,
      ) / 100;
    const totalPedidos = pedidosEnPeriodo.length;
    const ticketPromedio =
      totalPedidos > 0
        ? Math.round((ingresosTotales / totalPedidos) * 100) / 100
        : 0;

    const [serieVentas, productosMasVendidos] = await Promise.all([
      this.serieVentasPorPeriodo(desde, hasta, granularidad),
      this.calcularProductosMasVendidos(desde, hasta),
    ]);

    return {
      ingresosTotales,
      totalPedidos,
      ticketPromedio,
      serieVentas,
      productosMasVendidos,
    };
  }

  private async serieVentasPorPeriodo(
    desde: Date,
    hasta: Date,
    granularidad: 'dia' | 'semana' | 'mes',
  ): Promise<PuntoVenta[]> {
    const unidadTrunc =
      granularidad === 'dia'
        ? 'day'
        : granularidad === 'semana'
          ? 'week'
          : 'month';

    const filas = await this.pedidos
      .createQueryBuilder('pedido')
      .select('date_trunc(:unidad, pedido.fecha)', 'periodo')
      .addSelect('COALESCE(SUM(pedido.total), 0)', 'total')
      .where('pedido.fecha BETWEEN :desde AND :hasta', { desde, hasta })
      .andWhere('pedido.estado_pago = :pagado', { pagado: EstadoPago.PAGADO })
      .setParameter('unidad', unidadTrunc)
      .groupBy('periodo')
      .orderBy('periodo', 'ASC')
      .getRawMany<{ periodo: Date; total: string }>();

    return filas.map((fila) => ({
      etiqueta: this.formatearEtiquetaPeriodo(fila.periodo, granularidad),
      total: Number(fila.total),
    }));
  }

  private async calcularProductosMasVendidos(
    desde: Date,
    hasta: Date,
  ): Promise<ProductoMasVendido[]> {
    const filas = await this.itemsPedido
      .createQueryBuilder('item')
      .innerJoin('item.pedido', 'pedido')
      .innerJoin('item.producto', 'producto')
      .select('producto.id', 'productoId')
      .addSelect('producto.nombre', 'nombre')
      .addSelect('SUM(item.cantidad)', 'cantidad')
      .addSelect('SUM(item.cantidad * item.precio_unitario)', 'ingresos')
      .where('pedido.fecha BETWEEN :desde AND :hasta', { desde, hasta })
      .andWhere('pedido.estado_pago = :pagado', { pagado: EstadoPago.PAGADO })
      .groupBy('producto.id')
      .addGroupBy('producto.nombre')
      .orderBy('cantidad', 'DESC')
      .limit(LIMITE_PRODUCTOS_MAS_VENDIDOS)
      .getRawMany<{
        productoId: string;
        nombre: string;
        cantidad: string;
        ingresos: string;
      }>();

    return filas.map((fila) => ({
      productoId: fila.productoId,
      nombre: fila.nombre,
      cantidad: Number(fila.cantidad),
      ingresos: Number(fila.ingresos),
    }));
  }

  private restarDias(fecha: Date, dias: number): Date {
    const resultado = new Date(fecha);
    resultado.setDate(resultado.getDate() - dias);
    return resultado;
  }

  private formatearEtiquetaPeriodo(
    periodo: Date,
    granularidad: 'dia' | 'semana' | 'mes',
  ): string {
    const fecha = new Date(periodo);
    if (granularidad === 'mes') {
      return fecha.toLocaleDateString('es-MX', {
        month: 'short',
        year: 'numeric',
      });
    }
    return fecha.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
    });
  }
}
