import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AplicaA, Audiencia, Categoria, TipoDescuento } from './enums';
import { Producto } from './producto.entity';

/**
 * Esta entidad la escribe (CRUD) el módulo vendedor (/vendedor/ofertas en el front admin).
 * Este backend (lado cliente) solo la LEE, vía OffersService.calcularPrecio(), para
 * mostrar precios con descuento en catálogo y cobrar correctamente en checkout.
 */
@Entity('ofertas')
export class Oferta {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({
    type: 'enum',
    enum: TipoDescuento,
    enumName: 'tipo_descuento_enum',
    name: 'tipo_descuento',
  })
  tipoDescuento: TipoDescuento;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  valor: number;

  @Column({
    type: 'enum',
    enum: AplicaA,
    enumName: 'aplica_a_enum',
    name: 'aplica_a',
  })
  aplicaA: AplicaA;

  @ManyToOne(() => Producto, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto | null;

  @Column({ type: 'uuid', name: 'producto_id', nullable: true })
  productoId: string | null;

  @Column({
    type: 'enum',
    enum: Categoria,
    enumName: 'categoria_enum',
    nullable: true,
  })
  categoria: Categoria | null;

  @Column({
    type: 'enum',
    enum: Audiencia,
    enumName: 'audiencia_enum',
    nullable: true,
  })
  audiencia: Audiencia | null;

  @Column({ type: 'date', name: 'fecha_inicio' })
  fechaInicio: string;

  @Column({ type: 'date', name: 'fecha_fin' })
  fechaFin: string;

  @Column({ type: 'boolean', default: true })
  activa: boolean;
}
