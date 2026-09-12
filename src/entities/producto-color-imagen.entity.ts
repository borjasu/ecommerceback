import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Producto } from './producto.entity';

// Foto real de una prenda en un color específico, subida a mano por el
// vendedor (ver ProductoColorImagenesService) — reemplaza al algoritmo de
// recoloreo que existía antes (generaba la variante de color a partir de la
// foto base con HSL; se eliminó por resultados poco confiables). NO es una
// variante de stock: este backend todavía no tiene modelo de
// talla+color+stock (eso hoy solo existe simulado en el frontend), así que
// esta tabla se mantiene deliberadamente desacoplada del catálogo Color —
// el vendedor nombra el color libremente (ej. "Verde olivo") sin depender de
// que exista un registro correspondiente en `colores`. Un archivo de imagen en
// disco (uploads/productos-colores/<id>.<ext>) respalda cada fila; por eso el
// borrado es físico (ver ProductoColorImagenesService.eliminar), no lógico
// como el resto del dominio: no hay pedidos históricos que referencien esto,
// es una foto que el vendedor puede volver a subir si la borra por error.
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
