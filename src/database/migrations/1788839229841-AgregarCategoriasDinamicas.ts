import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reemplaza el enum fijo `categoria_enum` por un catálogo dinámico (ver
 * entities/categoria.entity.ts, modules/catalogos) — mismo espíritu que la
 * migración CatalogosColorTalla, pero MÁS SIMPLE: a diferencia de Color/Talla
 * (relación many-to-many, un producto puede tener varios), un producto tiene
 * EXACTAMENTE una categoría, así que en vez de convertirla en relación
 * cargada (que obligaría a tocar filtros/rutas/comparaciones de ofertas que
 * hoy tratan `categoria` como string plano), se deja como columna varchar
 * con un FK real:
 *   - productos.categoria → categorias.nombre, ON DELETE RESTRICT: Postgres
 *     mismo rechaza borrar una categoría en uso (ver CategoriasService.eliminar,
 *     que además hace un chequeo previo para dar un mensaje claro en vez de
 *     dejar burbujear el error crudo de FK).
 *   - ofertas.categoria: mismo cambio de tipo, SIN FK — es un snapshot suelto
 *     (igual que ItemPedido.talla/color), para que una oferta vieja nunca
 *     bloquee borrar una categoría que ya no tiene productos.
 *
 * Los valores de texto de los 4 miembros del enum YA SON los nombres que se
 * siembran aquí (pantalon/playera/camisa/bermuda), así que `::text` basta
 * para migrar los datos existentes sin perder nada.
 */
export class AgregarCategoriasDinamicas1788839229841
  implements MigrationInterface
{
  name = 'AgregarCategoriasDinamicas1788839229841';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categorias" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "nombre" varchar(60) NOT NULL,
        "icono" varchar(40) NOT NULL,
        "orden" integer NOT NULL,
        CONSTRAINT "uq_categorias_nombre" UNIQUE ("nombre")
      )
    `);

    // Semilla: las 4 categorías que ya existían como enum, con un ícono
    // razonable ya asignado — para no perder lo que ya existe ni romper
    // productos actuales que las usan.
    await queryRunner.query(`
      INSERT INTO "categorias" ("nombre", "icono", "orden") VALUES
        ('pantalon', 'pantalon', 1),
        ('playera', 'playera', 2),
        ('camisa', 'camisa', 3),
        ('bermuda', 'bermuda', 4)
    `);

    // productos.categoria: enum -> varchar, mismos valores de texto.
    await queryRunner.query(
      `ALTER TABLE "productos" ALTER COLUMN "categoria" TYPE varchar(60) USING "categoria"::text`,
    );
    await queryRunner.query(`
      ALTER TABLE "productos"
      ADD CONSTRAINT "fk_productos_categoria" FOREIGN KEY ("categoria")
      REFERENCES "categorias" ("nombre") ON DELETE RESTRICT
    `);

    // ofertas.categoria: enum -> varchar (nullable, sin FK — ver comentario arriba).
    await queryRunner.query(
      `ALTER TABLE "ofertas" ALTER COLUMN "categoria" TYPE varchar(60) USING "categoria"::text`,
    );

    // Ya nada depende del tipo enum — se libera.
    await queryRunner.query(`DROP TYPE "categoria_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "categoria_enum" AS ENUM ('pantalon', 'playera', 'camisa', 'bermuda')`,
    );

    await queryRunner.query(
      `ALTER TABLE "ofertas" ALTER COLUMN "categoria" TYPE categoria_enum USING "categoria"::categoria_enum`,
    );

    await queryRunner.query(
      `ALTER TABLE "productos" DROP CONSTRAINT "fk_productos_categoria"`,
    );
    await queryRunner.query(
      `ALTER TABLE "productos" ALTER COLUMN "categoria" TYPE categoria_enum USING "categoria"::categoria_enum`,
    );

    await queryRunner.query(`DROP TABLE "categorias"`);
  }
}
