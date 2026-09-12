import { ProductoColorImagen } from '../../entities';

// Foto por color subida por el vendedor (ver ProductoColorImagenesService).
// Igual que producto-con-precio.mapper.ts: nunca se expone la entidad
// TypeORM cruda (evita filtrar la relación `producto` cargada).
// imagenPublicId tampoco se expone: es un detalle interno de Cloudinary
// (necesario solo para poder borrar la imagen), no algo que el frontend use.
export type ProductoColorImagenPlano = Omit<
  ProductoColorImagen,
  'producto' | 'imagenPublicId'
>;

export function aProductoColorImagenPlano(
  entidad: ProductoColorImagen,
): ProductoColorImagenPlano {
  return {
    id: entidad.id,
    productoId: entidad.productoId,
    nombreColor: entidad.nombreColor,
    colorHex: entidad.colorHex,
    imagenUrl: entidad.imagenUrl,
    creadoEn: entidad.creadoEn,
  };
}
