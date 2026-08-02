import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabla para POST /contacto (público, sin JwtAuthGuard) — conecta la página
 * /contacto del frontend, hasta ahora estática, a un backend real.
 */
export class CrearMensajeContacto1785583762401 implements MigrationInterface {
  name = 'CrearMensajeContacto1785583762401';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "mensajes_contacto" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "nombre" varchar(150) NOT NULL,
        "email" varchar(255) NOT NULL,
        "mensaje" text NOT NULL,
        "fecha" timestamptz NOT NULL DEFAULT now(),
        "leido" boolean NOT NULL DEFAULT false
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_mensajes_contacto_leido" ON "mensajes_contacto" ("leido")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_mensajes_contacto_leido"`);
    await queryRunner.query(`DROP TABLE "mensajes_contacto"`);
  }
}
