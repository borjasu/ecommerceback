import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Agrega el desglose estructurado de la dirección (calle, numero_exterior,
 * numero_interior, colonia, municipio, estado, referencias) al snapshot de
 * envío del pedido — necesario para que ShippingService.generarGuia (panel
 * del vendedor) cotice/genere la guía con area_level1/2/3 reales en vez de
 * reusar "ciudad" tres veces (ver auditoría del prompt).
 *
 * Deliberadamente NO se tocan "envio_direccion"/"envio_ciudad": el panel del
 * vendedor y "Mis pedidos" del comprador siguen leyéndolos tal cual, y
 * OrdersService.crear los sigue calculando a partir de estos campos nuevos
 * (ver DatosEnvio.embeddable.ts) — así ninguna de esas dos vistas necesita
 * cambiar. Todas las columnas nuevas son nullable porque los pedidos creados
 * antes de esta migración no tienen este desglose.
 */
export class DatosEnvioEstructurado1788839229839 implements MigrationInterface {
  name = 'DatosEnvioEstructurado1788839229839';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pedidos" ADD COLUMN "envio_calle" varchar(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" ADD COLUMN "envio_numero_exterior" varchar(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" ADD COLUMN "envio_numero_interior" varchar(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" ADD COLUMN "envio_colonia" varchar(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" ADD COLUMN "envio_municipio" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" ADD COLUMN "envio_estado" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" ADD COLUMN "envio_referencias" varchar(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pedidos" DROP COLUMN "envio_calle"`);
    await queryRunner.query(
      `ALTER TABLE "pedidos" DROP COLUMN "envio_numero_exterior"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" DROP COLUMN "envio_numero_interior"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" DROP COLUMN "envio_colonia"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" DROP COLUMN "envio_municipio"`,
    );
    await queryRunner.query(`ALTER TABLE "pedidos" DROP COLUMN "envio_estado"`);
    await queryRunner.query(
      `ALTER TABLE "pedidos" DROP COLUMN "envio_referencias"`,
    );
  }
}
