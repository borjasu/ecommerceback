import { ProductoColorImagen } from '../../entities';

// Igual que producto-con-precio.mapper.ts: nunca se expone la entidad
// TypeORM cruda (evita filtrar la relación `producto` cargada).
export type ProductoColorImagenPlano = Omit<ProductoColorImagen, 'producto'>;

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
