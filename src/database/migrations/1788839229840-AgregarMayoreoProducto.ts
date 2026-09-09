import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Precio de mayoreo por producto (opcional, un solo nivel): mayoreo_habilitado
 * default false para no afectar productos existentes; cantidad_minima/
 * precio_por_pieza nullable porque solo aplican cuando el mayoreo está
 * habilitado (ver VendorProductsService, que valida eso en el DTO/servicio,
 * no en la BD).
 */
export class AgregarMayoreoProducto1788839229840
  implements MigrationInterface
{
  name = 'AgregarMayoreoProducto1788839229840';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "productos"
      ADD COLUMN "mayoreo_habilitado" boolean NOT NULL DEFAULT false,
      ADD COLUMN "mayoreo_cantidad_minima" integer NULL,
      ADD COLUMN "mayoreo_precio_por_pieza" decimal(10,2) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "productos"
      DROP COLUMN "mayoreo_precio_por_pieza",
      DROP COLUMN "mayoreo_cantidad_minima",
      DROP COLUMN "mayoreo_habilitado"
    `);
  }
}
