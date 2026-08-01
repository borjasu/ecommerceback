import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
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

  // Snapshot de texto libre, NO una relación a Talla/Color: un pedido histórico
  // debe conservar el nombre exacto que el cliente compró aunque ese color o
  // talla se desactive (o incluso si su fila llegara a desaparecer del catálogo).
  @Column({ type: 'varchar', length: 20 })
  talla: string;

  @Column({ type: 'varchar', length: 60 })
  color: string;

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
