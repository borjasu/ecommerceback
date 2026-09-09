import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria, Producto } from '../../entities';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';

const CODIGO_VIOLACION_UNIQUE_POSTGRES = '23505';
// foreign_key_violation — backstop si un producto se asignó a la categoría
// justo entre el conteo de abajo y el DELETE (condición de carrera
// improbable pero posible con dos vendedores/pestañas a la vez).
const CODIGO_VIOLACION_FK_POSTGRES = '23503';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categorias: Repository<Categoria>,
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
  ) {}

  listarTodas(): Promise<Categoria[]> {
    return this.categorias.find({ order: { orden: 'ASC' } });
  }

  async crear(dto: CrearCategoriaDto): Promise<Categoria> {
    const nueva = this.categorias.create(dto);

    try {
      return await this.categorias.save(nueva);
    } catch (error) {
      if (this.esViolacionDeUnicidad(error)) {
        throw new ConflictException('Ya existe una categoría con ese nombre.');
      }
      throw error;
    }
  }

  async eliminar(id: string): Promise<void> {
    const categoria = await this.obtenerOFallar(id);

    // A diferencia de Color/Talla (borrado lógico, nunca rechazan), una
    // categoría en uso SÍ bloquea el borrado — decisión explícita del
    // negocio: no tiene sentido "desactivar" una categoría con productos
    // activos, hay que resolver eso primero (recategorizar o desactivar esos
    // productos). Se cuenta por nombre porque Producto.categoria es un
    // snapshot de texto (ver entities/producto.entity.ts), no una relación.
    const productosConCategoria = await this.productos.count({
      where: { categoria: categoria.nombre },
    });

    if (productosConCategoria > 0) {
      throw new BadRequestException(
        `No puedes eliminar "${categoria.nombre}": ${productosConCategoria} producto(s) la usan.`,
      );
    }

    try {
      await this.categorias.delete({ id });
    } catch (error) {
      if (this.esViolacionDeFk(error)) {
        throw new BadRequestException(
          `No puedes eliminar "${categoria.nombre}": hay producto(s) usándola.`,
        );
      }
      throw error;
    }
  }

  /**
   * Exige que el nombre exista en el catálogo vigente — usado por
   * VendorProductsService al crear/actualizar un producto, mismo criterio
   * que ColoresService/TallasService.resolverActivosPorNombre.
   */
  async existeOFallar(nombre: string): Promise<void> {
    const existe = await this.categorias.exists({ where: { nombre } });
    if (!existe) {
      throw new BadRequestException(
        `La categoría "${nombre}" no existe o ya no está disponible.`,
      );
    }
  }

  private async obtenerOFallar(id: string): Promise<Categoria> {
    const categoria = await this.categorias.findOne({ where: { id } });
    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada.');
    }
    return categoria;
  }

  private esViolacionDeUnicidad(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === CODIGO_VIOLACION_UNIQUE_POSTGRES
    );
  }

  private esViolacionDeFk(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === CODIGO_VIOLACION_FK_POSTGRES
    );
  }
}
