import { Producto } from '../../entities';
import { PrecioConOferta } from '../offers/offers.service';

export type ProductoConPrecio = Producto & PrecioConOferta;

export function aProductoConPrecio(
  producto: Producto,
  precio: PrecioConOferta,
): ProductoConPrecio {
  return { ...producto, ...precio };
}
