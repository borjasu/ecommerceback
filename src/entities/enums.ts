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

// Talla y Color YA NO son enums fijos: son catálogos dinámicos con CRUD propio
// y borrado lógico (ver entities/talla.entity.ts y entities/color.entity.ts,
// y el módulo modules/catalogos). Un Producto los referencia por relación
// many-to-many; un ItemPedido guarda el nombre como snapshot de texto libre.

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
