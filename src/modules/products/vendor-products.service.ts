import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto } from '../../entities';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';

const CODIGO_VIOLACION_UNIQUE_POSTGRES = '23505';

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
  ) {}

  async crear(dto: CrearProductoDto): Promise<Producto> {
    const nuevo = this.productos.create({
      ...dto,
      sku: this.generarSku(dto.categoria),
      imagenes: dto.imagenes ?? null,
      etiqueta: dto.etiqueta ?? null,
      destacado: dto.destacado ?? false,
    });

    try {
      return await this.productos.save(nuevo);
    } catch (error) {
      if (this.esViolacionDeUnicidad(error)) {
        // Colisión extremadamente improbable del sku con timestamp; un reintento
        // con un sufijo distinto resuelve sin exponerle el detalle al vendedor.
        nuevo.sku = this.generarSku(dto.categoria);
        return this.productos.save(nuevo);
      }
      throw error;
    }
  }

  async actualizar(id: string, dto: ActualizarProductoDto): Promise<Producto> {
    const producto = await this.obtenerOFallar(id);
    await this.productos.update({ id }, dto);
    return { ...producto, ...dto };
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
    const producto = await this.productos.findOne({ where: { id } });
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
