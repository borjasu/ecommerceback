import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Producto } from './producto.entity';

@Entity('favoritos')
@Unique('uq_favorito_usuario_producto', ['usuarioId', 'productoId'])
export class Favorito {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario, (usuario) => usuario.favoritos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @ManyToOne(() => Producto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;

  @Column({ type: 'uuid', name: 'producto_id' })
  productoId: string;

  @CreateDateColumn({ name: 'fecha' })
  fecha: Date;
}
