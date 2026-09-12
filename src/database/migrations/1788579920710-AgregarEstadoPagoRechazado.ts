import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Antes, un pago que Mercado Pago reportaba como rechazado/cancelado
 * (status: 'rejected'/'cancelled') se guardaba como estadoPago='pendiente' —
 * indistinguible de un pago legítimamente pendiente (p. ej. un ticket OXXO
 * que el comprador todavía no paga). Se agrega 'rechazado' al enum para que
 * el vendedor pueda distinguir ambos casos (ver
 * PaymentsService.verificarYActualizarPorPaymentId).
 */
export class AgregarEstadoPagoRechazado1788579920710
  implements MigrationInterface
{
  name = 'AgregarEstadoPagoRechazado1788579920710';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Postgres 12+ permite ADD VALUE dentro de una transacción SIEMPRE que
    // el valor nuevo no se use en la misma transacción en la que se agrega
    // — este up() solo agrega el valor, nunca lo usa.
    await queryRunner.query(
      `ALTER TYPE "estado_pago_enum" ADD VALUE 'rechazado'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres no soporta quitar un valor de un enum directamente: se
    // reconstruye el tipo sin 'rechazado'. Si algún pedido real ya quedó en
    // ese estado, el USING de abajo falla — a propósito, en vez de borrar
    // ese dato en silencio.
    await queryRunner.query(
      `ALTER TYPE "estado_pago_enum" RENAME TO "estado_pago_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "estado_pago_enum" AS ENUM ('pendiente', 'pagado', 'reembolsado')`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" ALTER COLUMN "estado_pago" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" ALTER COLUMN "estado_pago" TYPE "estado_pago_enum" USING "estado_pago"::text::"estado_pago_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pedidos" ALTER COLUMN "estado_pago" SET DEFAULT 'pendiente'`,
    );
    await queryRunner.query(`DROP TYPE "estado_pago_enum_old"`);
  }
}
