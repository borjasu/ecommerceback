import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Catálogo dinámico de categorías (reemplaza el antiguo enum fijo
// categoria_enum) — mismo patrón que Color/Talla (ver color.entity.ts/
// talla.entity.ts), pero SIN borrado lógico: a diferencia de esos dos,
// Categoria no tiene `activo`. DELETE /categorias/:id borra la fila de
// verdad y se RECHAZA si algún producto la sigue usando (ver
// CategoriasService.eliminar) — decisión explícita, no un descuido: una
// categoría no tiene sentido "desactivada pero disponible" como sí lo tiene
// un color o talla que ya viene en pedidos históricos.
//
// `Producto.categoria`/`Oferta.categoria` la referencian por NOMBRE (varchar
// con FK a `categorias.nombre`, ver migración AgregarCategoriasDinamicas),
// no por relación cargada — igual de invasivo que evitar convertir esos
// campos en objetos, para no tocar todo el código que hoy los trata como
// string (filtros, rutas de catálogo, comparación de ofertas).
@Entity('categorias')
export class Categoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60, unique: true })
  nombre: string;

  // Nombre/identificador de un ícono de una lista predefinida y cerrada (ver
  // modules/catalogos/constants/iconos-categoria.ts) — no una URL ni un SVG
  // libre, para no depender de subir/alojar archivos por cada categoría.
  @Column({ type: 'varchar', length: 40 })
  icono: string;

  // Orden de despliegue en el menú/selectores — mismo criterio que Talla.orden.
  @Column({ type: 'int' })
  orden: number;
}
