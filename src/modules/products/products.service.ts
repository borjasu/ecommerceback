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

export interface FiltrosDisponibles {
  tallas: string[];
  colores: string[];
  precioMin: number;
  precioMax: number;
}

// coloresDisponibles/tallasDisponibles son relaciones many-to-many (ver
// entities/producto.entity.ts) — TypeORM nunca las carga solas por lazy
// loading, así que toda consulta pública que vaya a devolver un Producto debe
// pedirlas explícito con esto (o su equivalente leftJoinAndSelect en QueryBuilder).
const RELACIONES_CATALOGO = {
  coloresDisponibles: true,
  tallasDisponibles: true,
} as const;

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
    private readonly offersService: OffersService,
  ) {}

  async listar(query: ListarProductosQueryDto): Promise<PaginaDeProductos> {
    const qb = this.productos
      .createQueryBuilder('producto')
      .leftJoinAndSelect('producto.coloresDisponibles', 'colores')
      .leftJoinAndSelect('producto.tallasDisponibles', 'tallas')
      .where('producto.activo = true');

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
    // innerJoin (sin ...AndSelect) con un alias PROPIO solo para filtrar: no
    // reemplaza el leftJoinAndSelect de arriba, que sigue devolviendo TODOS los
    // colores/tallas del producto — si reutilizáramos el mismo alias para
    // filtrar y seleccionar a la vez, el WHERE recortaría también las filas
    // seleccionadas y un producto con 3 colores se vería con solo 1 en la respuesta.
    if (query.talla) {
      qb.innerJoin(
        'producto.tallasDisponibles',
        'tallaFiltro',
        'tallaFiltro.nombre = :talla',
        { talla: query.talla },
      );
    }
    if (query.color) {
      qb.innerJoin(
        'producto.coloresDisponibles',
        'colorFiltro',
        'colorFiltro.nombre = :color',
        { color: query.color },
      );
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
      .leftJoinAndSelect('producto.coloresDisponibles', 'colores')
      .leftJoinAndSelect('producto.tallasDisponibles', 'tallas')
      .where('producto.activo = true')
      .andWhere(
        '(producto.nombre ILIKE :termino OR producto.descripcion ILIKE :termino)',
        { termino: `%${termino}%` },
      )
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

  /**
   * Valores de talla/color y rango de precio que EXISTEN de verdad entre los
   * productos activos ahora mismo — no la lista fija/completa del catálogo
   * dinámico (modules/catalogos), que puede incluir tallas/colores sin ningún
   * producto activo usándolos. El panel de filtros del cliente consume esto
   * para no ofrecer una opción que de todos modos daría cero resultados.
   */
  async filtrosDisponibles(): Promise<FiltrosDisponibles> {
    const tallas = await this.productos
      .createQueryBuilder('producto')
      .innerJoin('producto.tallasDisponibles', 'talla')
      .where('producto.activo = true')
      .distinct(true)
      .select('talla.nombre', 'nombre')
      .addSelect('talla.orden', 'orden')
      .orderBy('talla.orden', 'ASC')
      .getRawMany<{ nombre: string; orden: number }>();

    const colores = await this.productos
      .createQueryBuilder('producto')
      .innerJoin('producto.coloresDisponibles', 'color')
      .where('producto.activo = true')
      .distinct(true)
      .select('color.nombre', 'nombre')
      .orderBy('color.nombre', 'ASC')
      .getRawMany<{ nombre: string }>();

    const rangoPrecio = await this.productos
      .createQueryBuilder('producto')
      .where('producto.activo = true')
      .select('MIN(producto.precio)', 'min')
      .addSelect('MAX(producto.precio)', 'max')
      .getRawOne<{ min: string | null; max: string | null }>();

    return {
      tallas: tallas.map((t) => t.nombre),
      colores: colores.map((c) => c.nombre),
      precioMin: rangoPrecio?.min != null ? Number(rangoPrecio.min) : 0,
      precioMax: rangoPrecio?.max != null ? Number(rangoPrecio.max) : 0,
    };
  }

  async destacados(): Promise<ProductoConPrecio[]> {
    const productos = await this.productos.find({
      where: { destacado: true, activo: true },
      relations: RELACIONES_CATALOGO,
    });
    const ofertasVigentes = await this.offersService.obtenerOfertasVigentes();
    return productos.map((producto) =>
      aProductoConPrecio(
        producto,
        this.offersService.calcularPrecioConOfertas(producto, ofertasVigentes),
      ),
    );
  }

  async obtenerPorId(id: string): Promise<ProductoConPrecio> {
    const producto = await this.productos.findOne({
      where: { id, activo: true },
      relations: RELACIONES_CATALOGO,
    });

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
