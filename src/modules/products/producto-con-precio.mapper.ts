import { Producto } from '../../entities';
import { PrecioConOferta } from '../offers/offers.service';
import {
  aProductoColorImagenPlano,
  ProductoColorImagenPlano,
} from './producto-color-imagen.mapper';

// coloresDisponibles/tallasDisponibles en la entidad son relaciones (Color[]/
// Talla[], ver entities/producto.entity.ts) pero el contrato de la API hacia
// el frontend sigue siendo un array de nombres (string[]) — nunca se expone
// la entidad completa del catálogo (id, activo, valorHex) en la respuesta de
// producto, solo el nombre que el catálogo/carrito necesitan. imagenesColores
// (relación hacia ProductoColorImagen, ver ProductoColorImagenesService) se
// aplana por la misma razón: nunca se expone la entidad cruda con su relación
// circular de vuelta a `producto`.
export type ProductoPlano = Omit<
  Producto,
  'coloresDisponibles' | 'tallasDisponibles' | 'imagenesColores'
> & {
  coloresDisponibles: string[];
  tallasDisponibles: string[];
  imagenesColores: ProductoColorImagenPlano[];
};

export function aProductoPlano(producto: Producto): ProductoPlano {
  return {
    ...producto,
    coloresDisponibles: producto.coloresDisponibles.map((color) => color.nombre),
    tallasDisponibles: producto.tallasDisponibles.map((talla) => talla.nombre),
    // ?? []: la relación no viene cargada en todo caller (p. ej. un producto
    // recién creado nunca tiene fotos todavía) — ver RELACIONES_CATALOGO en
    // products.service.ts/vendor-products.service.ts para dónde sí se pide.
    imagenesColores: (producto.imagenesColores ?? []).map(
      aProductoColorImagenPlano,
    ),
  };
}

export type ProductoConPrecio = ProductoPlano & PrecioConOferta;

export function aProductoConPrecio(
  producto: Producto,
  precio: PrecioConOferta,
): ProductoConPrecio {
  return { ...aProductoPlano(producto), ...precio };
}
