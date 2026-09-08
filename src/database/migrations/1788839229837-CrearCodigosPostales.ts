import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo Nacional de Códigos Postales (SEPOMEX) — tabla de solo lectura
 * poblada por `npm run seed:codigos-postales` (ver
 * database/seeds/importar-codigos-postales.ts), NO por la app en runtime.
 * Un mismo código postal tiene varias filas (una por colonia), por eso el
 * índice es por "codigo_postal" y no único.
 */
export class CrearCodigosPostales1788839229837 implements MigrationInterface {
  name = 'CrearCodigosPostales1788839229837';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "codigos_postales" (
        "id" SERIAL PRIMARY KEY,
        "codigo_postal" varchar(5) NOT NULL,
        "colonia" varchar(120) NOT NULL,
        "municipio" varchar(100) NOT NULL,
        "estado" varchar(100) NOT NULL,
        "ciudad" varchar(100),
        "tipo_asentamiento" varchar(60)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_codigos_postales_cp" ON "codigos_postales" ("codigo_postal")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "codigos_postales"`);
  }
}
