import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Estado de rastreo real del envío (created/picked_up/in_transit/...) —
 * texto libre, no enum de Postgres: ver InfoEnvio.trackingStatus para el
 * porqué (no hay documentación oficial confirmada con la lista completa y
 * exacta de valores que puede mandar Skydropx).
 */
export class AgregarTrackingStatusPedido1785583762402
  implements MigrationInterface
{
  name = 'AgregarTrackingStatusPedido1785583762402';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pedidos" ADD COLUMN "envio_tracking_status" varchar(40)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pedidos" DROP COLUMN "envio_tracking_status"`,
    );
  }
}
