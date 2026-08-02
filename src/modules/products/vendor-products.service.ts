import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto } from '../../entities';
import { ColoresService } from '../catalogos/colores.service';
import { TallasService } from '../catalogos/tallas.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { aProductoPlano, ProductoPlano } from './producto-con-precio.mapper';

const CODIGO_VIOLACION_UNIQUE_POSTGRES = '23505';

// coloresDisponibles/tallasDisponibles son relaciones (ver entities/producto.entity.ts)
// — hace falta pedirlas explícito, TypeORM no las carga solas.
const RELACIONES_CATALOGO = {
  coloresDisponibles: true,
  tallasDisponibles: true,
} as const;

/**
 * CRUD del lado vendedor sobre Producto — separado de ProductsService (que es
 * de solo lectura y público) para que quede claro cuál controlador expone
 * escritura y cuál no. Ambos comparten la misma entidad Producto.
 */
@Injectable()
export class VendorProductsService {
  constructor(
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
    private readonly coloresService: ColoresService,
    private readonly tallasService: TallasService,
  ) {}

  async crear(dto: CrearProductoDto): Promise<ProductoPlano> {
    const [colores, tallas] = await Promise.all([
      this.coloresService.resolverActivosPorNombre(dto.coloresDisponibles),
      this.tallasService.resolverActivosPorNombre(dto.tallasDisponibles),
    ]);

    const nuevo = this.productos.create({
      ...dto,
      coloresDisponibles: colores,
      tallasDisponibles: tallas,
      sku: this.generarSku(dto.categoria),
      imagenes: dto.imagenes ?? null,
      etiqueta: dto.etiqueta ?? null,
      destacado: dto.destacado ?? false,
    });

    try {
      const guardado = await this.productos.save(nuevo);
      return aProductoPlano(guardado);
    } catch (error) {
      if (this.esViolacionDeUnicidad(error)) {
        // Colisión extremadamente improbable del sku con timestamp; un reintento
        // con un sufijo distinto resuelve sin exponerle el detalle al vendedor.
        nuevo.sku = this.generarSku(dto.categoria);
        return aProductoPlano(await this.productos.save(nuevo));
      }
      throw error;
    }
  }

  async actualizar(
    id: string,
    dto: ActualizarProductoDto,
  ): Promise<ProductoPlano> {
    const producto = await this.obtenerOFallar(id);
    const { coloresDisponibles, tallasDisponibles, ...resto } = dto;

    if (coloresDisponibles) {
      producto.coloresDisponibles =
        await this.coloresService.resolverActivosPorNombre(coloresDisponibles);
    }
    if (tallasDisponibles) {
      producto.tallasDisponibles =
        await this.tallasService.resolverActivosPorNombre(tallasDisponibles);
    }

    Object.assign(producto, resto);
    return aProductoPlano(await this.productos.save(producto));
  }

  async eliminar(id: string): Promise<void> {
    await this.obtenerOFallar(id);

    // Borrado lógico: un producto con pedidos históricos no se puede borrar
    // físicamente sin romper ese historial (ItemPedido lo referencia), así
    // que "eliminar" del lado vendedor solo lo desactiva. Desaparece del
    // catálogo público de inmediato mientras sigue intacto en la base de
    // datos y en los pedidos ya existentes.
    await this.productos.update({ id }, { activo: false });
  }

  private async obtenerOFallar(id: string): Promise<Producto> {
    const producto = await this.productos.findOne({
      where: { id },
      relations: RELACIONES_CATALOGO,
    });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado.');
    }
    return producto;
  }

  private generarSku(categoria: string): string {
    return `FJ-${categoria.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
  }

  private esViolacionDeUnicidad(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === CODIGO_VIOLACION_UNIQUE_POSTGRES
    );
  }
}
