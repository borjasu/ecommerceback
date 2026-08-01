import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AplicaA, Oferta } from '../../entities';
import { CrearOfertaDto } from './dto/crear-oferta.dto';
import { ActualizarOfertaDto } from './dto/actualizar-oferta.dto';

/**
 * CRUD del lado vendedor sobre Oferta — separado de OffersService (que solo
 * calcula precios y es de lectura interna). Comparten la misma entidad.
 */
@Injectable()
export class OffersAdminService {
  constructor(
    @InjectRepository(Oferta) private readonly ofertas: Repository<Oferta>,
  ) {}

  listar(): Promise<Oferta[]> {
    return this.ofertas.find({ order: { fechaInicio: 'DESC' } });
  }

  async crear(dto: CrearOfertaDto): Promise<Oferta> {
    this.validarFechas(dto.fechaInicio, dto.fechaFin);

    const nueva = this.ofertas.create({
      nombre: dto.nombre,
      tipoDescuento: dto.tipoDescuento,
      valor: dto.valor,
      aplicaA: dto.aplicaA,
      productoId: dto.aplicaA === AplicaA.PRODUCTO ? dto.productoId! : null,
      categoria: dto.aplicaA === AplicaA.CATEGORIA ? dto.categoria! : null,
      audiencia: dto.aplicaA === AplicaA.AUDIENCIA ? dto.audiencia! : null,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      activa: dto.activa ?? true,
    });

    return this.ofertas.save(nueva);
  }

  async actualizar(id: string, dto: ActualizarOfertaDto): Promise<Oferta> {
    const oferta = await this.obtenerOFallar(id);

    const fechaInicio = dto.fechaInicio ?? oferta.fechaInicio;
    const fechaFin = dto.fechaFin ?? oferta.fechaFin;
    this.validarFechas(fechaInicio, fechaFin);

    const aplicaA = dto.aplicaA ?? oferta.aplicaA;
    await this.ofertas.update(
      { id },
      {
        ...dto,
        // Si cambia el alcance (aplicaA), limpiar los campos que ya no aplican
        // para no dejar basura (p. ej. una oferta que pasó de "producto" a
        // "categoría" pero conserva un productoId viejo).
        productoId:
          aplicaA === AplicaA.PRODUCTO
            ? (dto.productoId ?? oferta.productoId)
            : null,
        categoria:
          aplicaA === AplicaA.CATEGORIA
            ? (dto.categoria ?? oferta.categoria)
            : null,
        audiencia:
          aplicaA === AplicaA.AUDIENCIA
            ? (dto.audiencia ?? oferta.audiencia)
            : null,
      },
    );

    return this.obtenerOFallar(id);
  }

  async eliminar(id: string): Promise<void> {
    await this.obtenerOFallar(id);
    await this.ofertas.delete({ id });
  }

  private async obtenerOFallar(id: string): Promise<Oferta> {
    const oferta = await this.ofertas.findOne({ where: { id } });
    if (!oferta) {
      throw new NotFoundException('Oferta no encontrada.');
    }
    return oferta;
  }

  private validarFechas(fechaInicio: string, fechaFin: string): void {
    if (new Date(fechaFin) < new Date(fechaInicio)) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio.',
      );
    }
  }
}
