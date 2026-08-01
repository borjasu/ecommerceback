import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ReportsService y VendorOrdersService filtran/agrupan constantemente por
 * fecha y estado_pago (dashboard, reportes por periodo, listado paginado con
 * filtros) — sin estos índices, cada consulta hace un full scan de "pedidos"
 * que solo empeora conforme crece la tabla.
 */
export class AgregarIndicesPedidos1785583762399 implements MigrationInterface {
  name = 'AgregarIndicesPedidos1785583762399';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "ix_pedidos_fecha" ON "pedidos" ("fecha")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_pedidos_estado_pago" ON "pedidos" ("estado_pago")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_pedidos_estado_pago"`);
    await queryRunner.query(`DROP INDEX "ix_pedidos_fecha"`);
  }
}
