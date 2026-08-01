import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MensajeContacto } from '../../entities';
import { CrearMensajeContactoDto } from './dto/crear-mensaje-contacto.dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(MensajeContacto)
    private readonly mensajes: Repository<MensajeContacto>,
  ) {}

  async crear(dto: CrearMensajeContactoDto): Promise<void> {
    const nuevo = this.mensajes.create({
      nombre: dto.nombre,
      email: dto.email.toLowerCase(),
      mensaje: dto.mensaje,
      leido: false,
    });
    await this.mensajes.save(nuevo);

    // TODO: enviar notificación por correo cuando se configure un proveedor
    // (SendGrid, Resend, etc.) — por ahora basta con dejar el mensaje guardado.
  }

  listar(): Promise<MensajeContacto[]> {
    return this.mensajes.find({ order: { fecha: 'DESC' } });
  }
}
