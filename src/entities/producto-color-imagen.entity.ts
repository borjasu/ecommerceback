import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Producto } from './producto.entity';

// Artefacto visual generado por el algoritmo de recoloreo (ver RecoloreoService),
// NO una variante de stock: este backend todavía no tiene modelo de
// talla+color+stock (eso hoy solo existe simulado en el frontend), así que
// esta tabla se mantiene deliberadamente desacoplada del catálogo Color —
// el vendedor nombra el color libremente (ej. "Verde olivo") sin depender de
// que exista un registro correspondiente en `colores`. Un archivo PNG en
// disco (uploads/productos-colores/<id>.png) respalda cada fila; por eso el
// borrado es físico (ver ProductoColorImagenesService.eliminar), no lógico
// como el resto del dominio: no hay pedidos históricos que referencien esto,
// es un artefacto regenerable.
@Entity('producto_color_imagenes')
export class ProductoColorImagen {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Producto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;

  @Column({ type: 'uuid', name: 'producto_id' })
  productoId: string;

  @Column({ type: 'varchar', length: 60, name: 'nombre_color' })
  nombreColor: string;

  @Column({ type: 'varchar', length: 9, name: 'color_hex' })
  colorHex: string;

  @Column({ type: 'varchar', name: 'imagen_url' })
  imagenUrl: string;

  @Column({ type: 'timestamptz', name: 'creado_en', default: () => 'now()' })
  creadoEn: Date;
}
