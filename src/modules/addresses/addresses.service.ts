import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Direccion } from '../../entities';
import { CrearDireccionDto } from './dto/crear-direccion.dto';
import { ActualizarDireccionDto } from './dto/actualizar-direccion.dto';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Direccion)
    private readonly direcciones: Repository<Direccion>,
    private readonly dataSource: DataSource,
  ) {}

  listar(usuarioId: string): Promise<Direccion[]> {
    return this.direcciones.find({
      where: { usuarioId },
      order: { predeterminada: 'DESC' },
    });
  }

  async obtenerUnaDelUsuario(
    id: string,
    usuarioId: string,
  ): Promise<Direccion> {
    // where: { id, usuarioId } en una sola consulta — nunca "buscar por id y luego
    // comparar dueño en JS": así una dirección ajena da 404 igual que una que no
    // existe, sin distinción (mitiga IDOR, OWASP A01).
    const direccion = await this.direcciones.findOne({
      where: { id, usuarioId },
    });

    if (!direccion) {
      throw new NotFoundException('Dirección no encontrada.');
    }

    return direccion;
  }

  async crear(usuarioId: string, dto: CrearDireccionDto): Promise<Direccion> {
    if (dto.predeterminada) {
      return this.crearComoPredeterminada(usuarioId, dto);
    }

    const nueva = this.direcciones.create({
      ...dto,
      usuarioId,
      predeterminada: false,
    });
    return this.direcciones.save(nueva);
  }

  async actualizar(
    id: string,
    usuarioId: string,
    dto: ActualizarDireccionDto,
  ): Promise<Direccion> {
    await this.obtenerUnaDelUsuario(id, usuarioId);

    if (dto.predeterminada === true) {
      return this.actualizarYMarcarPredeterminada(id, usuarioId, dto);
    }

    await this.direcciones.update({ id, usuarioId }, dto);
    return this.obtenerUnaDelUsuario(id, usuarioId);
  }

  async eliminar(id: string, usuarioId: string): Promise<void> {
    await this.obtenerUnaDelUsuario(id, usuarioId);
    await this.direcciones.delete({ id, usuarioId });
  }

  private async crearComoPredeterminada(
    usuarioId: string,
    dto: CrearDireccionDto,
  ): Promise<Direccion> {
    return this.dataSource.transaction(async (manager) => {
      await manager.update(Direccion, { usuarioId }, { predeterminada: false });
      const nueva = manager.create(Direccion, {
        ...dto,
        usuarioId,
        predeterminada: true,
      });
      return manager.save(nueva);
    });
  }

  private async actualizarYMarcarPredeterminada(
    id: string,
    usuarioId: string,
    dto: ActualizarDireccionDto,
  ): Promise<Direccion> {
    return this.dataSource.transaction(async (manager) => {
      // Atómico: desmarcar todas las demás y aplicar los cambios (incluida esta
      // como predeterminada) ocurre en la misma transacción — nunca queda un
      // estado intermedio con dos direcciones predeterminadas o ninguna.
      await manager.update(Direccion, { usuarioId }, { predeterminada: false });
      await manager.update(Direccion, { id, usuarioId }, dto);
      const actualizada = await manager.findOne(Direccion, {
        where: { id, usuarioId },
      });
      if (!actualizada) {
        throw new NotFoundException('Dirección no encontrada.');
      }
      return actualizada;
    });
  }
}
