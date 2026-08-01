import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto } from '../../entities';
import { OffersService } from '../offers/offers.service';
import {
  ListarProductosQueryDto,
  BuscarProductosQueryDto,
} from './dto/listar-productos-query.dto';
import {
  aProductoConPrecio,
  ProductoConPrecio,
} from './producto-con-precio.mapper';

export interface PaginaDeProductos {
  data: ProductoConPrecio[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
    private readonly offersService: OffersService,
  ) {}

  async listar(query: ListarProductosQueryDto): Promise<PaginaDeProductos> {
    const qb = this.productos.createQueryBuilder('producto');

    // Todo parametrizado vía query builder — nunca concatenación de strings en SQL
    // (mitiga inyección SQL, OWASP A03).
    if (query.audiencia) {
      qb.andWhere('producto.audiencia = :audiencia', {
        audiencia: query.audiencia,
      });
    }
    if (query.categoria) {
      qb.andWhere('producto.categoria = :categoria', {
        categoria: query.categoria,
      });
    }
    if (query.talla) {
      qb.andWhere(':talla = ANY(producto.tallasDisponibles)', {
        talla: query.talla,
      });
    }
    if (query.color) {
      qb.andWhere(':color = ANY(producto.coloresDisponibles)', {
        color: query.color,
      });
    }

    const candidatos = await qb.getMany();
    return this.aplicarPrecioOrdenYPaginacion(
      candidatos,
      query.precioMin,
      query.precioMax,
      query.orden,
      query.page,
      query.limit,
    );
  }

  async buscar(query: BuscarProductosQueryDto): Promise<PaginaDeProductos> {
    const termino = query.q.trim();

    if (!termino) {
      return { data: [], total: 0, page: query.page, limit: query.limit };
    }

    const candidatos = await this.productos
      .createQueryBuilder('producto')
      .where('producto.nombre ILIKE :termino', { termino: `%${termino}%` })
      .orWhere('producto.descripcion ILIKE :termino', {
        termino: `%${termino}%`,
      })
      .getMany();

    return this.aplicarPrecioOrdenYPaginacion(
      candidatos,
      undefined,
      undefined,
      undefined,
      query.page,
      query.limit,
    );
  }

  async destacados(): Promise<ProductoConPrecio[]> {
    const productos = await this.productos.find({ where: { destacado: true } });
    const ofertasVigentes = await this.offersService.obtenerOfertasVigentes();
    return productos.map((producto) =>
      aProductoConPrecio(
        producto,
        this.offersService.calcularPrecioConOfertas(producto, ofertasVigentes),
      ),
    );
  }

  async obtenerPorId(id: string): Promise<ProductoConPrecio> {
    const producto = await this.productos.findOne({ where: { id } });

    if (!producto) {
      // 404 sin detalle interno — no distingue "id con formato inválido" de
      // "no existe", ambos casos dan el mismo mensaje genérico.
      throw new NotFoundException('Producto no encontrado.');
    }

    const precio = await this.offersService.calcularPrecio(producto);
    return aProductoConPrecio(producto, precio);
  }

  private async aplicarPrecioOrdenYPaginacion(
    candidatos: Producto[],
    precioMin: number | undefined,
    precioMax: number | undefined,
    orden: 'asc' | 'desc' | undefined,
    page: number,
    limit: number,
  ): Promise<PaginaDeProductos> {
    const ofertasVigentes = await this.offersService.obtenerOfertasVigentes();

    let conPrecio = candidatos.map((producto) =>
      aProductoConPrecio(
        producto,
        this.offersService.calcularPrecioConOfertas(producto, ofertasVigentes),
      ),
    );

    if (precioMin != null) {
      conPrecio = conPrecio.filter(
        (producto) => producto.precioFinal >= precioMin,
      );
    }
    if (precioMax != null) {
      conPrecio = conPrecio.filter(
        (producto) => producto.precioFinal <= precioMax,
      );
    }

    if (orden) {
      conPrecio = [...conPrecio].sort((a, b) =>
        orden === 'asc'
          ? a.precioFinal - b.precioFinal
          : b.precioFinal - a.precioFinal,
      );
    }

    const total = conPrecio.length;
    const inicio = (page - 1) * limit;
    const data = conPrecio.slice(inicio, inicio + limit);

    return { data, total, page, limit };
  }
}
