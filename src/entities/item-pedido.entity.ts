import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Color, Talla } from './enums';
import { Pedido } from './pedido.entity';
import { Producto } from './producto.entity';

@Entity('items_pedido')
export class ItemPedido {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Pedido, (pedido) => pedido.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pedido_id' })
  pedido: Pedido;

  @Column({ type: 'uuid', name: 'pedido_id' })
  pedidoId: string;

  // RESTRICT: nunca se debe poder borrar un Producto que ya tiene pedidos históricos.
  @ManyToOne(() => Producto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;

  @Column({ type: 'uuid', name: 'producto_id' })
  productoId: string;

  @Column({ type: 'enum', enum: Talla, enumName: 'talla_enum' })
  talla: Talla;

  @Column({ type: 'enum', enum: Color, enumName: 'color_enum' })
  color: Color;

  @Column({ type: 'int' })
  cantidad: number;

  // Snapshot del precio FINAL (ya con descuento aplicado) al momento de comprar.
  // Nunca se recalcula después — si la oferta cambia o expira, este pedido histórico
  // conserva lo que realmente se cobró.
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'precio_unitario',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  precioUnitario: number;
}
