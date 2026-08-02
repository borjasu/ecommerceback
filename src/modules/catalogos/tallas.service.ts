import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Talla } from '../../entities';
import { CrearTallaDto } from './dto/crear-talla.dto';
import { ActualizarTallaDto } from './dto/actualizar-talla.dto';

const CODIGO_VIOLACION_UNIQUE_POSTGRES = '23505';

@Injectable()
export class TallasService {
  constructor(
    @InjectRepository(Talla) private readonly tallas: Repository<Talla>,
  ) {}

  listarActivas(): Promise<Talla[]> {
    return this.tallas.find({ where: { activo: true }, order: { orden: 'ASC' } });
  }

  listarTodas(): Promise<Talla[]> {
    return this.tallas.find({ order: { orden: 'ASC' } });
  }

  async crear(dto: CrearTallaDto): Promise<Talla> {
    const nueva = this.tallas.create({
      nombre: dto.nombre,
      orden: dto.orden,
      activo: dto.activo ?? true,
    });

    try {
      return await this.tallas.save(nueva);
    } catch (error) {
      if (this.esViolacionDeUnicidad(error)) {
        throw new ConflictException('Ya existe una talla con ese nombre.');
      }
      throw error;
    }
  }

  async actualizar(id: string, dto: ActualizarTallaDto): Promise<Talla> {
    await this.obtenerOFallar(id);

    try {
      await this.tallas.update({ id }, dto);
    } catch (error) {
      if (this.esViolacionDeUnicidad(error)) {
        throw new ConflictException('Ya existe una talla con ese nombre.');
      }
      throw error;
    }

    return this.obtenerOFallar(id);
  }

  async eliminar(id: string): Promise<void> {
    await this.obtenerOFallar(id);

    // Borrado lógico: mismo criterio que Color — una talla ya usada en
    // productos o en pedidos históricos no puede desaparecer de la BD.
    await this.tallas.update({ id }, { activo: false });
  }

  /**
   * Resuelve nombres de talla a sus entidades, exigiendo que existan y estén
   * activas — usado por VendorProductsService al crear/actualizar un producto.
   */
  async resolverActivosPorNombre(nombres: string[]): Promise<Talla[]> {
    const nombresUnicos = [...new Set(nombres)];
    const encontradas = await this.tallas.find({
      where: { nombre: In(nombresUnicos), activo: true },
    });

    if (encontradas.length !== nombresUnicos.length) {
      throw new BadRequestException(
        'Una o más tallas no existen o ya no están disponibles.',
      );
    }

    return encontradas;
  }

  private async obtenerOFallar(id: string): Promise<Talla> {
    const talla = await this.tallas.findOne({ where: { id } });
    if (!talla) {
      throw new NotFoundException('Talla no encontrada.');
    }
    return talla;
  }

  private esViolacionDeUnicidad(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === CODIGO_VIOLACION_UNIQUE_POSTGRES
    );
  }
}
