import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('direcciones')
export class Direccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario, (usuario) => usuario.direcciones, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @Column({ type: 'varchar', length: 60 })
  alias: string;

  @Column({ type: 'varchar', length: 150, name: 'nombre_completo' })
  nombreCompleto: string;

  @Column({ type: 'varchar', length: 255 })
  direccion: string;

  @Column({ type: 'varchar', length: 100 })
  ciudad: string;

  @Column({ type: 'varchar', length: 10, name: 'codigo_postal' })
  codigoPostal: string;

  @Column({ type: 'varchar', length: 20 })
  telefono: string;

  @Column({ type: 'boolean', default: false })
  predeterminada: boolean;
}
