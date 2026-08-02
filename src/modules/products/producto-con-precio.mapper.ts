import { Producto } from '../../entities';
import { PrecioConOferta } from '../offers/offers.service';

// coloresDisponibles/tallasDisponibles en la entidad son relaciones (Color[]/
// Talla[], ver entities/producto.entity.ts) pero el contrato de la API hacia
// el frontend sigue siendo un array de nombres (string[]) — nunca se expone
// la entidad completa del catálogo (id, activo, valorHex) en la respuesta de
// producto, solo el nombre que el catálogo/carrito necesitan.
export type ProductoPlano = Omit<
  Producto,
  'coloresDisponibles' | 'tallasDisponibles'
> & {
  coloresDisponibles: string[];
  tallasDisponibles: string[];
};

export function aProductoPlano(producto: Producto): ProductoPlano {
  return {
    ...producto,
    coloresDisponibles: producto.coloresDisponibles.map((color) => color.nombre),
    tallasDisponibles: producto.tallasDisponibles.map((talla) => talla.nombre),
  };
}

export type ProductoConPrecio = ProductoPlano & PrecioConOferta;

export function aProductoConPrecio(
  producto: Producto,
  precio: PrecioConOferta,
): ProductoConPrecio {
  return { ...aProductoPlano(producto), ...precio };
}
