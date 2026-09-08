import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sustituye el campo de texto libre "direccion" (y el "ciudad" suelto que
 * Skydropx nunca pudo usar bien, ver auditoría del prompt) por los campos
 * estructurados que exige Skydropx para cotizar/generar guías con precisión:
 * calle, numero_exterior, numero_interior, colonia, municipio, estado.
 *
 * Backfill best-effort para filas que ya existan (de pruebas manuales):
 * como el dato viejo no distinguía calle/colonia/municipio/estado, se copia
 * completo a "calle" y "ciudad" a "municipio" — no hay forma de reconstruir
 * la separación real, así que se marca con un "S/N" en numero_exterior para
 * que quede visible que esa fila necesita corregirse a mano si importa.
 */
export class DireccionEstructurada1788839229838 implements MigrationInterface {
  name = 'DireccionEstructurada1788839229838';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "direcciones" ADD COLUMN "calle" varchar(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" ADD COLUMN "numero_exterior" varchar(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" ADD COLUMN "numero_interior" varchar(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" ADD COLUMN "colonia" varchar(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" ADD COLUMN "municipio" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" ADD COLUMN "estado" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" ADD COLUMN "referencias" varchar(255)`,
    );

    await queryRunner.query(`
      UPDATE "direcciones" SET
        "calle" = "direccion",
        "numero_exterior" = 'S/N',
        "colonia" = 'Sin especificar',
        "municipio" = "ciudad",
        "estado" = "ciudad"
      WHERE "calle" IS NULL
    `);

    await queryRunner.query(
      `ALTER TABLE "direcciones" ALTER COLUMN "calle" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" ALTER COLUMN "numero_exterior" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" ALTER COLUMN "colonia" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" ALTER COLUMN "municipio" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" ALTER COLUMN "estado" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "direcciones" DROP COLUMN "direccion"`,
    );
    await queryRunner.query(`ALTER TABLE "direcciones" DROP COLUMN "ciudad"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "direcciones" ADD COLUMN "direccion" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" ADD COLUMN "ciudad" varchar(100)`,
    );
    await queryRunner.query(`
      UPDATE "direcciones" SET
        "direccion" = "calle" || ' ' || "numero_exterior" ||
          CASE WHEN "numero_interior" IS NOT NULL THEN ' Int. ' || "numero_interior" ELSE '' END,
        "ciudad" = "municipio"
    `);
    await queryRunner.query(
      `ALTER TABLE "direcciones" ALTER COLUMN "direccion" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" ALTER COLUMN "ciudad" SET NOT NULL`,
    );

    await queryRunner.query(`ALTER TABLE "direcciones" DROP COLUMN "calle"`);
    await queryRunner.query(
      `ALTER TABLE "direcciones" DROP COLUMN "numero_exterior"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direcciones" DROP COLUMN "numero_interior"`,
    );
    await queryRunner.query(`ALTER TABLE "direcciones" DROP COLUMN "colonia"`);
    await queryRunner.query(
      `ALTER TABLE "direcciones" DROP COLUMN "municipio"`,
    );
    await queryRunner.query(`ALTER TABLE "direcciones" DROP COLUMN "estado"`);
    await queryRunner.query(
      `ALTER TABLE "direcciones" DROP COLUMN "referencias"`,
    );
  }
}
