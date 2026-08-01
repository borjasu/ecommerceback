export enum RolUsuario {
  COMPRADOR = 'comprador',
  VENDEDOR = 'vendedor',
}

export enum Categoria {
  PANTALON = 'pantalon',
  PLAYERA = 'playera',
  CAMISA = 'camisa',
  BERMUDA = 'bermuda',
}

export enum Audiencia {
  HOMBRE = 'hombre',
  NINO = 'nino',
}

export enum Talla {
  S = 'S',
  M = 'M',
  L = 'L',
  XL = 'XL',
}

// Catálogo base de colores. TODO(vendedor-side): cuando el módulo admin necesite
// colores personalizados por vendedor (el frontend ya lo soporta como string libre),
// esto debe migrar de enum a una tabla `Color` con FK, igual que se documentó como
// riesgo de diseño en el inventario de modelos previo a este backend.
export enum Color {
  NEGRO = 'negro',
  AZUL = 'azul',
  GRIS = 'gris',
  BEIGE = 'beige',
  BLANCO = 'blanco',
  CAFE = 'cafe',
}

export enum Etiqueta {
  NUEVO = 'NUEVO',
  ESENCIAL = 'ESENCIAL',
}

export enum EstadoPedido {
  PENDIENTE = 'pendiente',
  ENVIADO = 'enviado',
  ENTREGADO = 'entregado',
  CANCELADO = 'cancelado',
}

export enum EstadoPago {
  PENDIENTE = 'pendiente',
  PAGADO = 'pagado',
  REEMBOLSADO = 'reembolsado',
}

export enum MetodoPago {
  TARJETA = 'tarjeta',
  EFECTIVO = 'efectivo',
}

export enum TipoDescuento {
  PORCENTAJE = 'porcentaje',
  MONTO_FIJO = 'monto_fijo',
}

export enum AplicaA {
  PRODUCTO = 'producto',
  CATEGORIA = 'categoria',
  AUDIENCIA = 'audiencia',
}
