import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabla de auditoría para cambios manuales de estadoPago (confirmar pago en
 * efectivo, marcar reembolso) — registra qué vendedor hizo el cambio y cuándo.
 */
export class CrearPedidoAuditoria1785583762398 implements MigrationInterface {
  name = 'CrearPedidoAuditoria1785583762398';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pedido_auditoria" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "pedido_id" uuid NOT NULL,
        "campo" varchar(60) NOT NULL,
        "valor_anterior" varchar(60) NOT NULL,
        "valor_nuevo" varchar(60) NOT NULL,
        "usuario_id" uuid NOT NULL,
        "fecha" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_pedido_auditoria_pedido" FOREIGN KEY ("pedido_id") REFERENCES "pedidos" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_pedido_auditoria_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_pedido_auditoria_pedido_id" ON "pedido_auditoria" ("pedido_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "pedido_auditoria"`);
  }
}
