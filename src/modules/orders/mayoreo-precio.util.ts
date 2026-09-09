import { Producto } from '../../entities';

/**
 * Extraído de OrdersService.crear() para poder probarlo de forma aislada
 * (ver mayoreo-precio.util.spec.ts) — es la pieza autoritativa de seguridad
 * del cálculo de precio: nunca se confía en un precio unitario que mande el
 * cliente, siempre se recalcula aquí a partir del catálogo real y de las
 * cantidades reales pedidas.
 */

/** Suma la cantidad pedida de cada producto, sin importar en cuántas líneas (tallas/colores) venga repartida. */
export function agruparCantidadesPorProducto(
  items: { productoId: string; cantidad: number }[],
): Map<string, number> {
  const cantidadPorProducto = new Map<string, number>();
  for (const item of items) {
    cantidadPorProducto.set(
      item.productoId,
      (cantidadPorProducto.get(item.productoId) ?? 0) + item.cantidad,
    );
  }
  return cantidadPorProducto;
}

/**
 * Precio unitario real a cobrar por una línea de este producto: el de mayoreo
 * si el producto lo tiene habilitado y la cantidad TOTAL pedida de ese
 * producto (todas sus tallas/colores combinados, no esta línea sola) alcanza
 * el mínimo — en ese caso aplica a TODAS las piezas del producto, no solo al
 * excedente, y reemplaza el precio con oferta (no se combinan ambos). Si no
 * aplica mayoreo, se usa `precioConOferta` (ya resuelto aparte por
 * OffersService, que sigue aplicando igual que antes de esta feature).
 */
export function resolverPrecioUnitario(
  producto: Pick<
    Producto,
    'mayoreoHabilitado' | 'mayoreoCantidadMinima' | 'mayoreoPrecioPorPieza'
  >,
  cantidadTotalDelProducto: number,
  precioConOferta: number,
): number {
  const aplicaMayoreo =
    producto.mayoreoHabilitado &&
    producto.mayoreoCantidadMinima != null &&
    producto.mayoreoPrecioPorPieza != null &&
    cantidadTotalDelProducto >= producto.mayoreoCantidadMinima;

  return aplicaMayoreo ? producto.mayoreoPrecioPorPieza! : precioConOferta;
}
