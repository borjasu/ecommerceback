// Lista cerrada de íconos que una Categoria puede usar (ver
// entities/categoria.entity.ts). No son URLs ni SVG libres: son nombres que
// el frontend resuelve a un ícono dibujado a mano (ver shared/components/
// icono-categoria en ecommerfront) — el proyecto no usa ninguna librería de
// íconos, así que esta lista es la única fuente de verdad de qué valores son
// válidos. Debe mantenerse sincronizada con el array equivalente del
// frontend (mismo criterio que CATEGORIAS/AUDIENCIAS, que ya se duplican
// entre frontend/backend sin un paquete compartido).
export const ICONOS_CATEGORIA_VALIDOS = [
  'pantalon',
  'playera',
  'camisa',
  'bermuda',
  'chamarra',
  'sudadera',
  'calcetines',
  'gorra',
  'cinturon',
  'zapatos',
  'ropa_interior',
  'traje_bano',
  'pijama',
  'accesorio',
] as const;

export type IconoCategoria = (typeof ICONOS_CATEGORIA_VALIDOS)[number];
