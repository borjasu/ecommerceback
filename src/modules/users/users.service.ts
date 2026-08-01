import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../../entities';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  async buscarPorId(id: string): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({ where: { id } });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }
    return usuario;
  }

  async actualizarPerfil(
    id: string,
    dto: ActualizarPerfilDto,
  ): Promise<Usuario> {
    // Solo nombre/teléfono son editables aquí — email y rol nunca se tocan por
    // este endpoint (cambiar email/rol requeriría su propio flujo con verificación).
    await this.usuarios.update(
      { id },
      {
        ...(dto.nombre ? { nombre: dto.nombre } : {}),
        ...(dto.telefono ? { telefono: dto.telefono } : {}),
      },
    );
    return this.buscarPorId(id);
  }
}
