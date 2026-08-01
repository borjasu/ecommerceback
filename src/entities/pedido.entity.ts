import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoPago, EstadoPedido, MetodoPago } from './enums';
import { Usuario } from './usuario.entity';
import { ItemPedido } from './item-pedido.entity';
import { DatosEnvio } from './datos-envio.embeddable';
import { InfoEnvio } from './info-envio.embeddable';

const decimalTransformer = {
  to: (value: number) => value,
  from: (value: string) => Number(value),
};

@Entity('pedidos')
export class Pedido {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true, name: 'numero_pedido' })
  numeroPedido: string;

  @ManyToOne(() => Usuario, (usuario) => usuario.pedidos, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @OneToMany(() => ItemPedido, (item) => item.pedido, { cascade: true })
  items: ItemPedido[];

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  subtotal: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'costo_envio',
    transformer: decimalTransformer,
  })
  costoEnvio: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  total: number;

  // prefix: false — los nombres de columna ya vienen con su propio prefijo
  // "envio_*" definido en el @Column de cada campo de DatosEnvio; sin esto,
  // TypeORM antepone además el nombre de esta propiedad ("datosEnvio") y las
  // columnas reales no coinciden con las que crea la migración.
  @Column(() => DatosEnvio, { prefix: false })
  datosEnvio: DatosEnvio;

  @Column({
    type: 'enum',
    enum: MetodoPago,
    enumName: 'metodo_pago_enum',
    name: 'metodo_pago',
  })
  metodoPago: MetodoPago;

  @Column({
    type: 'enum',
    enum: EstadoPedido,
    enumName: 'estado_pedido_enum',
    default: EstadoPedido.PENDIENTE,
  })
  estado: EstadoPedido;

  @Column({
    type: 'enum',
    enum: EstadoPago,
    enumName: 'estado_pago_enum',
    default: EstadoPago.PENDIENTE,
    name: 'estado_pago',
  })
  estadoPago: EstadoPago;

  @Column(() => InfoEnvio, { prefix: false })
  infoEnvio: InfoEnvio;

  @CreateDateColumn({ name: 'fecha' })
  fecha: Date;
}
