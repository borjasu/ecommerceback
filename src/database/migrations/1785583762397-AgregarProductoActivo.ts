import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Borrado lógico de Producto: DELETE /productos/:id (vendedor) deja de borrar
 * físico y ahora solo pone activo = false. El catálogo público filtra
 * activo = true en todas sus consultas (ProductsService).
 */
export class AgregarProductoActivo1785583762397 implements MigrationInterface {
  name = 'AgregarProductoActivo1785583762397';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "productos" ADD COLUMN "activo" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_productos_activo" ON "productos" ("activo")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_productos_activo"`);
    await queryRunner.query(`ALTER TABLE "productos" DROP COLUMN "activo"`);
  }
}
