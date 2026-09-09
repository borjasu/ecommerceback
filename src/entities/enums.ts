export enum RolUsuario {
  COMPRADOR = 'comprador',
  VENDEDOR = 'vendedor',
}

// Categoria YA NO es un enum fijo: es un catálogo dinámico con CRUD propio,
// SIN borrado lógico (ver entities/categoria.entity.ts y modules/catalogos).
// Producto.categoria/Oferta.categoria pasan de columna enum a varchar
// (Producto con FK real a categorias.nombre; Oferta sin FK, snapshot suelto
// — ver migración AgregarCategoriasDinamicas).

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
  // Mercado Pago reportó el pago como rejected/cancelled (ver
  // PaymentsService.verificarYActualizarPorPaymentId) — distinto de
  // PENDIENTE: ahí el comprador simplemente no ha completado el pago
  // (p. ej. ticket OXXO sin pagar todavía), aquí sí lo intentó y fue
  // rechazado. Antes ambos casos caían en PENDIENTE, indistinguibles para
  // el vendedor.
  RECHAZADO = 'rechazado',
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
