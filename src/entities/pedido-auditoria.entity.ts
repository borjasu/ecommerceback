import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Pedido } from './pedido.entity';
import { Usuario } from './usuario.entity';

/**
 * Registro de auditoría para cambios manuales de estadoPago (confirmar un
 * pago en efectivo, marcar un reembolso, etc.) — a diferencia del estado del
 * pedido o del pago vía Mercado Pago, esto lo decide un humano, así que
 * queda registro de quién y cuándo. Hoy solo hay un vendedor, pero esto
 * escala sin cambios si algún día hay más de uno.
 */
@Entity('pedido_auditoria')
export class PedidoAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Pedido, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pedido_id' })
  pedido: Pedido;

  @Column({ type: 'uuid', name: 'pedido_id' })
  pedidoId: string;

  @Column({ type: 'varchar', length: 60 })
  campo: string;

  @Column({ type: 'varchar', length: 60, name: 'valor_anterior' })
  valorAnterior: string;

  @Column({ type: 'varchar', length: 60, name: 'valor_nuevo' })
  valorNuevo: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'uuid', name: 'usuario_id' })
  usuarioId: string;

  @CreateDateColumn({ name: 'fecha' })
  fecha: Date;
}
