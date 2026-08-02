import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reemplaza los enums fijos `color_enum`/`talla_enum` por catálogos dinámicos
 * con CRUD propio y borrado lógico (ver modules/catalogos, entities/color.entity.ts,
 * entities/talla.entity.ts). Producto.coloresDisponibles/tallasDisponibles pasan
 * de ser columnas array de enum a relaciones many-to-many (producto_colores,
 * producto_tallas). items_pedido.talla/color pasan de enum a varchar: son un
 * snapshot de texto libre del pedido histórico, no una relación — así un color
 * o talla desactivado (o renombrado) después de la compra no afecta pedidos ya hechos.
 *
 * La migración de datos existentes (no solo el cambio de esquema) es la parte
 * delicada: los valores que ya estaban en las columnas array se insertan en las
 * tablas intermedias ANTES de borrar esas columnas, para no perder qué color/talla
 * tenía cada producto ya creado.
 */
export class CatalogosColorTalla1785583762400 implements MigrationInterface {
  name = 'CatalogosColorTalla1785583762400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------- Catálogos ----------
    await queryRunner.query(`
      CREATE TABLE "colores" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "nombre" varchar(60) NOT NULL,
        "valor_hex" varchar(9),
        "activo" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_colores_nombre" UNIQUE ("nombre")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_colores_activo" ON "colores" ("activo")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tallas" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "nombre" varchar(20) NOT NULL,
        "orden" integer NOT NULL,
        "activo" boolean NOT NULL DEFAULT true,
        CONSTRAINT "uq_tallas_nombre" UNIQUE ("nombre")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_tallas_activo" ON "tallas" ("activo")`,
    );

    // Semilla: mismos valores que tenía el enum fijo, para que los productos
    // existentes puedan resolverse por nombre al migrar sus datos abajo.
    await queryRunner.query(`
      INSERT INTO "colores" ("nombre", "valor_hex", "activo") VALUES
        ('negro', '#14110d', true),
        ('azul', '#2b3a55', true),
        ('gris', '#8a8a8a', true),
        ('beige', '#d9c9a3', true),
        ('blanco', '#f5f5f0', true),
        ('cafe', '#6b4226', true)
    `);
    await queryRunner.query(`
      INSERT INTO "tallas" ("nombre", "orden", "activo") VALUES
        ('S', 1, true),
        ('M', 2, true),
        ('L', 3, true),
        ('XL', 4, true)
    `);

    // ---------- Tablas intermedias (many-to-many) ----------
    await queryRunner.query(`
      CREATE TABLE "producto_colores" (
        "producto_id" uuid NOT NULL,
        "color_id" uuid NOT NULL,
        CONSTRAINT "pk_producto_colores" PRIMARY KEY ("producto_id", "color_id"),
        CONSTRAINT "fk_producto_colores_producto" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_producto_colores_color" FOREIGN KEY ("color_id") REFERENCES "colores" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_producto_colores_producto_id" ON "producto_colores" ("producto_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_producto_colores_color_id" ON "producto_colores" ("color_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "producto_tallas" (
        "producto_id" uuid NOT NULL,
        "talla_id" uuid NOT NULL,
        CONSTRAINT "pk_producto_tallas" PRIMARY KEY ("producto_id", "talla_id"),
        CONSTRAINT "fk_producto_tallas_producto" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_producto_tallas_talla" FOREIGN KEY ("talla_id") REFERENCES "tallas" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_producto_tallas_producto_id" ON "producto_tallas" ("producto_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_producto_tallas_talla_id" ON "producto_tallas" ("talla_id")`,
    );

    // ---------- Migrar datos existentes de productos.*_disponibles (array) ----------
    await queryRunner.query(`
      INSERT INTO "producto_colores" ("producto_id", "color_id")
      SELECT p."id", c."id"
      FROM "productos" p
      CROSS JOIN unnest(p."colores_disponibles") AS valor
      JOIN "colores" c ON c."nombre" = valor::text
    `);
    await queryRunner.query(`
      INSERT INTO "producto_tallas" ("producto_id", "talla_id")
      SELECT p."id", t."id"
      FROM "productos" p
      CROSS JOIN unnest(p."tallas_disponibles") AS valor
      JOIN "tallas" t ON t."nombre" = valor::text
    `);

    await queryRunner.query(
      `ALTER TABLE "productos" DROP COLUMN "colores_disponibles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "productos" DROP COLUMN "tallas_disponibles"`,
    );

    // ---------- items_pedido.talla/color: de enum a snapshot de texto libre ----------
    await queryRunner.query(
      `ALTER TABLE "items_pedido" ALTER COLUMN "talla" TYPE varchar(20) USING "talla"::text`,
    );
    await queryRunner.query(
      `ALTER TABLE "items_pedido" ALTER COLUMN "color" TYPE varchar(60) USING "color"::text`,
    );

    // Ya nada depende de estos tipos — se liberan.
    await queryRunner.query(`DROP TYPE "color_enum"`);
    await queryRunner.query(`DROP TYPE "talla_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "color_enum" AS ENUM ('negro', 'azul', 'gris', 'beige', 'blanco', 'cafe')`,
    );
    await queryRunner.query(
      `CREATE TYPE "talla_enum" AS ENUM ('S', 'M', 'L', 'XL')`,
    );

    await queryRunner.query(
      `ALTER TABLE "items_pedido" ALTER COLUMN "talla" TYPE talla_enum USING "talla"::talla_enum`,
    );
    await queryRunner.query(
      `ALTER TABLE "items_pedido" ALTER COLUMN "color" TYPE color_enum USING "color"::color_enum`,
    );

    await queryRunner.query(
      `ALTER TABLE "productos" ADD COLUMN "colores_disponibles" color_enum[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "productos" ADD COLUMN "tallas_disponibles" talla_enum[]`,
    );

    await queryRunner.query(`
      UPDATE "productos" p
      SET "colores_disponibles" = sub.arr
      FROM (
        SELECT pc."producto_id", array_agg(c."nombre"::color_enum) AS arr
        FROM "producto_colores" pc
        JOIN "colores" c ON c."id" = pc."color_id"
        GROUP BY pc."producto_id"
      ) sub
      WHERE sub."producto_id" = p."id"
    `);
    await queryRunner.query(`
      UPDATE "productos" p
      SET "tallas_disponibles" = sub.arr
      FROM (
        SELECT pt."producto_id", array_agg(t."nombre"::talla_enum) AS arr
        FROM "producto_tallas" pt
        JOIN "tallas" t ON t."id" = pt."talla_id"
        GROUP BY pt."producto_id"
      ) sub
      WHERE sub."producto_id" = p."id"
    `);

    await queryRunner.query(
      `ALTER TABLE "productos" ALTER COLUMN "colores_disponibles" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "productos" ALTER COLUMN "tallas_disponibles" SET NOT NULL`,
    );

    await queryRunner.query(`DROP TABLE "producto_tallas"`);
    await queryRunner.query(`DROP TABLE "producto_colores"`);
    await queryRunner.query(`DROP TABLE "tallas"`);
    await queryRunner.query(`DROP TABLE "colores"`);
  }
}
