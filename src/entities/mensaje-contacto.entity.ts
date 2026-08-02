import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('mensajes_contacto')
export class MensajeContacto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  fecha: Date;

  @Column({ type: 'boolean', default: false })
  leido: boolean;
}
