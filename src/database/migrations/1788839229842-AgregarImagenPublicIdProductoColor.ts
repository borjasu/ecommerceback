import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración a Cloudinary para las fotos por color (ver CloudinaryService /
 * ProductoColorImagenesService): borrar una imagen en Cloudinary exige su
 * public_id, que no se puede derivar confiablemente de la URL — hace falta
 * guardarlo aparte. Nullable porque las filas creadas antes de esta migración
 * (con el fs.writeFile viejo, a disco local) no tienen uno; para esas,
 * eliminar() ya no intenta borrar nada del storage, solo la fila.
 */
export class AgregarImagenPublicIdProductoColor1788839229842
  implements MigrationInterface
{
  name = 'AgregarImagenPublicIdProductoColor1788839229842';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "producto_color_imagenes" ADD "imagen_public_id" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "producto_color_imagenes" DROP COLUMN "imagen_public_id"`,
    );
  }
}
