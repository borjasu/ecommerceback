import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Audiencia, Categoria, Etiqueta } from './enums';
import { Color } from './color.entity';
import { Talla } from './talla.entity';

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'text' })
  descripcion: string;

  // decimal, nunca float: evita errores de redondeo binario en dinero.
  // TypeORM devuelve columnas decimal como string por defecto salvo transformer;
  // usamos un transformer para trabajar con number en la app y decimal en la BD.
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  precio: number;

  @Column({ type: 'enum', enum: Categoria, enumName: 'categoria_enum' })
  categoria: Categoria;

  @Column({ type: 'enum', enum: Audiencia, enumName: 'audiencia_enum' })
  audiencia: Audiencia;

  // Relación (no enum): coloresDisponibles/tallasDisponibles referencian los
  // catálogos dinámicos Color/Talla vía tabla intermedia — nunca se cargan
  // solas por lazy-loading de TypeORM, cada query que las necesita debe pedirlas
  // explícito (relations: {...} o leftJoinAndSelect), ver products.service.ts.
  @ManyToMany(() => Color)
  @JoinTable({
    name: 'producto_colores',
    joinColumn: { name: 'producto_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'color_id', referencedColumnName: 'id' },
  })
  coloresDisponibles: Color[];

  @ManyToMany(() => Talla)
  @JoinTable({
    name: 'producto_tallas',
    joinColumn: { name: 'producto_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'talla_id', referencedColumnName: 'id' },
  })
  tallasDisponibles: Talla[];

  @Column({ type: 'varchar', name: 'imagen_url' })
  imagenUrl: string;

  @Column({ type: 'text', array: true, nullable: true })
  imagenes: string[] | null;

  @Column({
    type: 'enum',
    enum: Etiqueta,
    enumName: 'etiqueta_enum',
    nullable: true,
  })
  etiqueta: Etiqueta | null;

  @Column({ type: 'boolean', default: false })
  destacado: boolean;

  // Borrado lógico: un producto con pedidos históricos (ItemPedido lo referencia)
  // no se puede borrar físicamente sin romper ese historial, así que "eliminar"
  // del lado vendedor solo pone esto en false. El catálogo público (ProductsService)
  // filtra activo = true en todas sus consultas.
  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
