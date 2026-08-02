import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Catálogo dinámico de colores (reemplaza el antiguo enum fijo color_enum).
// Borrado lógico vía `activo`: un color ya usado en Producto.coloresDisponibles
// o en el snapshot de un ItemPedido histórico no se puede quitar de la base de
// datos sin romper esas referencias, así que DELETE /colores/:id solo desactiva.
@Entity('colores')
export class Color {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60, unique: true })
  nombre: string;

  @Column({ type: 'varchar', length: 9, name: 'valor_hex', nullable: true })
  valorHex: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
