import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabla de imágenes generadas por el algoritmo de recoloreo (ver
 * RecoloreoService) — un PNG por combinación producto+color, guardado en
 * disco (uploads/productos-colores/<id>.png) y referenciado aquí por
 * imagen_url. Deliberadamente desacoplada de "colores" (catálogo dinámico de
 * Color/Talla): el vendedor nombra el color libremente al generarlo, no hay
 * que forzar que exista un registro correspondiente en ese catálogo.
 *
 * uq_producto_color_imagenes_producto_nombre evita generar dos veces el
 * mismo nombre de color (case-insensitive) para un mismo producto.
 */
export class ProductoColorImagenes1785583762405 implements MigrationInterface {
  name = 'ProductoColorImagenes1785583762405';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "producto_color_imagenes" (
        "id" uuid PRIMARY KEY,
        "producto_id" uuid NOT NULL,
        "nombre_color" varchar(60) NOT NULL,
        "color_hex" varchar(9) NOT NULL,
        "imagen_url" varchar NOT NULL,
        "creado_en" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_producto_color_imagenes_producto" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_producto_color_imagenes_producto_id" ON "producto_color_imagenes" ("producto_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_producto_color_imagenes_producto_nombre" ON "producto_color_imagenes" ("producto_id", lower("nombre_color"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "producto_color_imagenes"`);
  }
}
