import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Distingue "cancelado a mano por el vendedor" de "cancelado automáticamente
 * por el job de limpieza de pedidos abandonados" (ver OrdersCleanupService) —
 * ambos casos terminan en estado='cancelado', esta columna es lo único que
 * los separa para que el panel pueda ocultar los abandonados por default.
 */
export class AgregarCanceladoPorAbandono1785583762404
  implements MigrationInterface
{
  name = 'AgregarCanceladoPorAbandono1785583762404';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pedidos" ADD COLUMN "cancelado_por_abandono" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_pedidos_cancelado_por_abandono" ON "pedidos" ("cancelado_por_abandono")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "ix_pedidos_cancelado_por_abandono"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" DROP COLUMN "cancelado_por_abandono"`,
    );
  }
}
