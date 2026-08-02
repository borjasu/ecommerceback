import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Color } from '../../entities';
import { CrearColorDto } from './dto/crear-color.dto';
import { ActualizarColorDto } from './dto/actualizar-color.dto';

const CODIGO_VIOLACION_UNIQUE_POSTGRES = '23505';

@Injectable()
export class ColoresService {
  constructor(
    @InjectRepository(Color) private readonly colores: Repository<Color>,
  ) {}

  listarActivos(): Promise<Color[]> {
    return this.colores.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });
  }

  listarTodos(): Promise<Color[]> {
    return this.colores.find({ order: { nombre: 'ASC' } });
  }

  async crear(dto: CrearColorDto): Promise<Color> {
    const nuevo = this.colores.create({
      nombre: dto.nombre,
      valorHex: dto.valorHex ?? null,
      activo: dto.activo ?? true,
    });

    try {
      return await this.colores.save(nuevo);
    } catch (error) {
      if (this.esViolacionDeUnicidad(error)) {
        throw new ConflictException('Ya existe un color con ese nombre.');
      }
      throw error;
    }
  }

  async actualizar(id: string, dto: ActualizarColorDto): Promise<Color> {
    await this.obtenerOFallar(id);

    try {
      await this.colores.update({ id }, dto);
    } catch (error) {
      if (this.esViolacionDeUnicidad(error)) {
        throw new ConflictException('Ya existe un color con ese nombre.');
      }
      throw error;
    }

    return this.obtenerOFallar(id);
  }

  async eliminar(id: string): Promise<void> {
    await this.obtenerOFallar(id);

    // Borrado lógico: un color ya usado en Producto.coloresDisponibles o en el
    // snapshot de un ItemPedido histórico no puede desaparecer de la base de
    // datos sin romper esas referencias, así que solo se desactiva.
    await this.colores.update({ id }, { activo: false });
  }

  /**
   * Resuelve nombres de color a sus entidades, exigiendo que existan y estén
   * activos — usado por VendorProductsService al crear/actualizar un producto,
   * nunca acepta un nombre que ya no está disponible en el catálogo vigente.
   */
  async resolverActivosPorNombre(nombres: string[]): Promise<Color[]> {
    const nombresUnicos = [...new Set(nombres)];
    const encontrados = await this.colores.find({
      where: { nombre: In(nombresUnicos), activo: true },
    });

    if (encontrados.length !== nombresUnicos.length) {
      throw new BadRequestException(
        'Uno o más colores no existen o ya no están disponibles.',
      );
    }

    return encontrados;
  }

  private async obtenerOFallar(id: string): Promise<Color> {
    const color = await this.colores.findOne({ where: { id } });
    if (!color) {
      throw new NotFoundException('Color no encontrado.');
    }
    return color;
  }

  private esViolacionDeUnicidad(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === CODIGO_VIOLACION_UNIQUE_POSTGRES
    );
  }
}
