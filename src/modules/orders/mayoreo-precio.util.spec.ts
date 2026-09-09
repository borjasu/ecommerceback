import { Producto } from '../../entities';
import {
  agruparCantidadesPorProducto,
  resolverPrecioUnitario,
} from './mayoreo-precio.util';

type ProductoMayoreo = Pick<
  Producto,
  'mayoreoHabilitado' | 'mayoreoCantidadMinima' | 'mayoreoPrecioPorPieza'
>;

function productoConMayoreo(
  overrides: Partial<ProductoMayoreo> = {},
): ProductoMayoreo {
  return {
    mayoreoHabilitado: true,
    mayoreoCantidadMinima: 6,
    mayoreoPrecioPorPieza: 150,
    ...overrides,
  };
}

describe('agruparCantidadesPorProducto', () => {
  it('suma la cantidad de un mismo producto repartida en varias líneas (tallas/colores distintos)', () => {
    const grupos = agruparCantidadesPorProducto([
      { productoId: 'p1', cantidad: 3 },
      { productoId: 'p1', cantidad: 3 },
      { productoId: 'p2', cantidad: 1 },
    ]);

    expect(grupos.get('p1')).toBe(6);
    expect(grupos.get('p2')).toBe(1);
  });
});

describe('resolverPrecioUnitario (cálculo autoritativo de precio, backend)', () => {
  it('usa el precio normal/con oferta si la cantidad total del producto NO alcanza el mínimo de mayoreo', () => {
    const producto = productoConMayoreo({ mayoreoCantidadMinima: 6 });

    // 3 en talla M + 2 en talla L = 5 piezas, no llega a 6.
    const precio = resolverPrecioUnitario(producto, 5, 250);

    expect(precio).toBe(250);
  });

  it('usa el precio de mayoreo para TODAS las piezas al alcanzar exactamente el mínimo, sumando tallas/colores', () => {
    const producto = productoConMayoreo({
      mayoreoCantidadMinima: 6,
      mayoreoPrecioPorPieza: 150,
    });

    // 3 en talla M + 3 en talla L = 6 piezas, cumple el mínimo.
    const precio = resolverPrecioUnitario(producto, 6, 250);

    expect(precio).toBe(150);
  });

  it('sigue aplicando el precio de mayoreo si la cantidad excede el mínimo (a TODAS las piezas, no solo al excedente)', () => {
    const producto = productoConMayoreo({
      mayoreoCantidadMinima: 6,
      mayoreoPrecioPorPieza: 150,
    });

    const precio = resolverPrecioUnitario(producto, 8, 250);

    expect(precio).toBe(150);
  });

  it('nunca aplica mayoreo si el producto no lo tiene habilitado, sin importar la cantidad', () => {
    const producto = productoConMayoreo({ mayoreoHabilitado: false });

    const precio = resolverPrecioUnitario(producto, 100, 250);

    expect(precio).toBe(250);
  });

  it('no aplica mayoreo si falta la cantidad mínima o el precio por pieza configurados (dato incompleto)', () => {
    const sinMinimo = productoConMayoreo({ mayoreoCantidadMinima: null });
    const sinPrecio = productoConMayoreo({ mayoreoPrecioPorPieza: null });

    expect(resolverPrecioUnitario(sinMinimo, 100, 250)).toBe(250);
    expect(resolverPrecioUnitario(sinPrecio, 100, 250)).toBe(250);
  });

  it('reemplaza el precio con oferta por el de mayoreo cuando ambos aplicarían (no se combinan)', () => {
    const producto = productoConMayoreo({
      mayoreoCantidadMinima: 6,
      mayoreoPrecioPorPieza: 150,
    });

    // precioConOferta simula que ya había un descuento vigente (ej. $200 con
    // oferta activa sobre un precio base de $250) — el mayoreo lo reemplaza.
    const precio = resolverPrecioUnitario(producto, 6, 200);

    expect(precio).toBe(150);
  });
});
