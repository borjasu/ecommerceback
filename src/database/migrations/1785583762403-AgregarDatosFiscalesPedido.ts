import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Datos de factura fiscal (opcional) — checkbox "Requiero factura fiscal" en
 * el checkout. Todo nullable: un pedido sin factura deja estas tres columnas en NULL.
 */
export class AgregarDatosFiscalesPedido1785583762403
  implements MigrationInterface
{
  name = 'AgregarDatosFiscalesPedido1785583762403';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pedidos"
      ADD COLUMN "fiscal_rfc" varchar(13),
      ADD COLUMN "fiscal_razon_social" varchar(200),
      ADD COLUMN "fiscal_regimen" varchar(10)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pedidos"
      DROP COLUMN "fiscal_rfc",
      DROP COLUMN "fiscal_razon_social",
      DROP COLUMN "fiscal_regimen"
    `);
  }
}
