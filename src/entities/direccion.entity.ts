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

  @Column({ type: 'varchar', length: 200 })
  calle: string;

  @Column({ type: 'varchar', length: 20, name: 'numero_exterior' })
  numeroExterior: string;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'numero_interior',
    nullable: true,
  })
  numeroInterior: string | null;

  // Estado/municipio SIEMPRE deben venir de la respuesta de
  // GET /codigos-postales/:cp (ver PostalCodesController) — el frontend los
  // bloquea como readonly una vez que el CP resuelve. Se guardan como texto
  // libre y no como FK a CodigoPostal a propósito: si el catálogo SEPOMEX no
  // cubre un CP (hueco de cobertura, ver auditoría del prompt), el frontend
  // cae a campos manuales editables y esta fila igual debe poder guardarse.
  @Column({ type: 'varchar', length: 120 })
  colonia: string;

  @Column({ type: 'varchar', length: 100 })
  municipio: string;

  @Column({ type: 'varchar', length: 100 })
  estado: string;

  @Column({ type: 'varchar', length: 10, name: 'codigo_postal' })
  codigoPostal: string;

  // Ej. "portón negro", "entre calles X y Y" — ayuda al repartidor, nunca
  // requerida por Skydropx.
  @Column({ type: 'varchar', length: 255, nullable: true })
  referencias: string | null;

  @Column({ type: 'varchar', length: 20 })
  telefono: string;

  @Column({ type: 'boolean', default: false })
  predeterminada: boolean;
}
