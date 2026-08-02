import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Catálogo dinámico de tallas (reemplaza el antiguo enum fijo talla_enum).
// `orden` es lo que permite mostrarlas siempre S/M/L/XL... en vez del orden
// alfabético o de inserción; borrado lógico vía `activo`, mismo criterio que Color.
@Entity('tallas')
export class Talla {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  nombre: string;

  @Column({ type: 'int' })
  orden: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
