import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { AplicaA, Oferta, Producto, TipoDescuento } from '../../entities';

export interface PrecioConOferta {
  precioOriginal: number;
  precioFinal: number;
  porcentajeDescuento: number;
  ofertaAplicada?: { id: string; nombre: string };
}

/**
 * Solo lectura/cálculo — el CRUD de Oferta (POST/PATCH/DELETE) vive en el módulo
 * vendedor. Este servicio replica exactamente la lógica que ya tenía OfertaService
 * en el frontend mock, para que el precio que ve el cliente en catálogo sea el mismo
 * que se le cobra en el checkout.
 */
@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Oferta) private readonly ofertasRepo: Repository<Oferta>,
  ) {}

  /** Una sola consulta a BD — úsalo para pintar precios de una página completa de catálogo. */
  async obtenerOfertasVigentes(): Promise<Oferta[]> {
    const hoy = new Date().toISOString().slice(0, 10);
    return this.ofertasRepo.find({
      where: {
        activa: true,
        fechaInicio: LessThanOrEqual(hoy),
        fechaFin: MoreThanOrEqual(hoy),
      },
    });
  }

  /** Función pura: no toca la BD, recibe las ofertas vigentes ya cargadas. */
  calcularPrecioConOfertas(
    producto: Producto,
    ofertasVigentes: Oferta[],
  ): PrecioConOferta {
    const aplicables = ofertasVigentes.filter((oferta) =>
      this.aplicaAProducto(oferta, producto),
    );

    if (aplicables.length === 0) {
      return {
        precioOriginal: producto.precio,
        precioFinal: producto.precio,
        porcentajeDescuento: 0,
      };
    }

    const mejor = aplicables.reduce((actualMejor, candidata) =>
      this.montoDescuento(producto.precio, candidata) >
      this.montoDescuento(producto.precio, actualMejor)
        ? candidata
        : actualMejor,
    );

    const descuento = this.montoDescuento(producto.precio, mejor);
    const precioFinal = Math.max(
      0,
      Math.round((producto.precio - descuento) * 100) / 100,
    );
    const porcentajeDescuento =
      producto.precio > 0 ? Math.round((descuento / producto.precio) * 100) : 0;

    return {
      precioOriginal: producto.precio,
      precioFinal,
      porcentajeDescuento,
      ofertaAplicada: { id: mejor.id, nombre: mejor.nombre },
    };
  }

  /** Conveniencia para un solo producto (p. ej. al recalcular una línea de pedido). */
  async calcularPrecio(producto: Producto): Promise<PrecioConOferta> {
    const vigentes = await this.obtenerOfertasVigentes();
    return this.calcularPrecioConOfertas(producto, vigentes);
  }

  private aplicaAProducto(oferta: Oferta, producto: Producto): boolean {
    switch (oferta.aplicaA) {
      case AplicaA.PRODUCTO:
        return oferta.productoId === producto.id;
      case AplicaA.CATEGORIA:
        return oferta.categoria === producto.categoria;
      case AplicaA.AUDIENCIA:
        return oferta.audiencia === producto.audiencia;
      default:
        return false;
    }
  }

  private montoDescuento(precio: number, oferta: Oferta): number {
    return oferta.tipoDescuento === TipoDescuento.PORCENTAJE
      ? precio * (oferta.valor / 100)
      : oferta.valor;
  }
}
