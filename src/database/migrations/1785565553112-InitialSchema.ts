import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración inicial, escrita a mano (no generada con `migration:generate`).
 *
 * Motivo: `migration:generate` funciona por diff de esquema contra una BD
 * Postgres real ya corriendo, y este entorno de desarrollo (sandbox) no tiene
 * Postgres disponible. El SQL de abajo refleja exactamente las entidades en
 * src/entities/*.entity.ts — antes de correrla contra una BD real, valídala con
 * `npm run migration:run` y confirma que coincide con lo que generaría TypeORM
 * (o corre `schema:log` contra una BD de desarrollo real para comparar).
 */
export class InitialSchema1785565553112 implements MigrationInterface {
  name = 'InitialSchema1785565553112';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ---------- Tipos enum compartidos ----------
    await queryRunner.query(
      `CREATE TYPE "rol_usuario_enum" AS ENUM ('comprador', 'vendedor')`,
    );
    await queryRunner.query(
      `CREATE TYPE "categoria_enum" AS ENUM ('pantalon', 'playera', 'camisa', 'bermuda')`,
    );
    await queryRunner.query(
      `CREATE TYPE "audiencia_enum" AS ENUM ('hombre', 'nino')`,
    );
    await queryRunner.query(
      `CREATE TYPE "talla_enum" AS ENUM ('S', 'M', 'L', 'XL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "color_enum" AS ENUM ('negro', 'azul', 'gris', 'beige', 'blanco', 'cafe')`,
    );
    await queryRunner.query(
      `CREATE TYPE "etiqueta_enum" AS ENUM ('NUEVO', 'ESENCIAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "estado_pedido_enum" AS ENUM ('pendiente', 'enviado', 'entregado', 'cancelado')`,
    );
    await queryRunner.query(
      `CREATE TYPE "estado_pago_enum" AS ENUM ('pendiente', 'pagado', 'reembolsado')`,
    );
    await queryRunner.query(
      `CREATE TYPE "metodo_pago_enum" AS ENUM ('tarjeta', 'efectivo')`,
    );
    await queryRunner.query(
      `CREATE TYPE "tipo_descuento_enum" AS ENUM ('porcentaje', 'monto_fijo')`,
    );
    await queryRunner.query(
      `CREATE TYPE "aplica_a_enum" AS ENUM ('producto', 'categoria', 'audiencia')`,
    );

    // ---------- usuarios ----------
    await queryRunner.query(`
      CREATE TABLE "usuarios" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "nombre" varchar(150) NOT NULL,
        "email" varchar(255) NOT NULL,
        "password_hash" varchar NOT NULL,
        "rol" rol_usuario_enum NOT NULL DEFAULT 'comprador',
        "telefono" varchar(30),
        "fecha_registro" timestamptz NOT NULL DEFAULT now(),
        "refresh_token_version" integer NOT NULL DEFAULT 0,
        CONSTRAINT "uq_usuarios_email" UNIQUE ("email")
      )
    `);

    // ---------- productos ----------
    await queryRunner.query(`
      CREATE TABLE "productos" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sku" varchar(40) NOT NULL,
        "nombre" varchar(150) NOT NULL,
        "descripcion" text NOT NULL,
        "precio" numeric(10,2) NOT NULL,
        "categoria" categoria_enum NOT NULL,
        "audiencia" audiencia_enum NOT NULL,
        "colores_disponibles" color_enum[] NOT NULL,
        "tallas_disponibles" talla_enum[] NOT NULL,
        "imagen_url" varchar NOT NULL,
        "imagenes" text[],
        "etiqueta" etiqueta_enum,
        "destacado" boolean NOT NULL DEFAULT false,
        CONSTRAINT "uq_productos_sku" UNIQUE ("sku")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_productos_categoria" ON "productos" ("categoria")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_productos_audiencia" ON "productos" ("audiencia")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_productos_destacado" ON "productos" ("destacado")`,
    );

    // ---------- direcciones ----------
    await queryRunner.query(`
      CREATE TABLE "direcciones" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "usuario_id" uuid NOT NULL,
        "alias" varchar(60) NOT NULL,
        "nombre_completo" varchar(150) NOT NULL,
        "direccion" varchar(255) NOT NULL,
        "ciudad" varchar(100) NOT NULL,
        "codigo_postal" varchar(10) NOT NULL,
        "telefono" varchar(20) NOT NULL,
        "predeterminada" boolean NOT NULL DEFAULT false,
        CONSTRAINT "fk_direcciones_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_direcciones_usuario_id" ON "direcciones" ("usuario_id")`,
    );

    // ---------- favoritos ----------
    await queryRunner.query(`
      CREATE TABLE "favoritos" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "usuario_id" uuid NOT NULL,
        "producto_id" uuid NOT NULL,
        "fecha" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_favoritos_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_favoritos_producto" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON DELETE CASCADE,
        CONSTRAINT "uq_favorito_usuario_producto" UNIQUE ("usuario_id", "producto_id")
      )
    `);

    // ---------- ofertas ----------
    // CRUD de escritura lo maneja el módulo vendedor; esta migración solo crea
    // la tabla para que ambos lados (cliente/admin) la compartan sin choques.
    await queryRunner.query(`
      CREATE TABLE "ofertas" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "nombre" varchar(150) NOT NULL,
        "tipo_descuento" tipo_descuento_enum NOT NULL,
        "valor" numeric(10,2) NOT NULL,
        "aplica_a" aplica_a_enum NOT NULL,
        "producto_id" uuid,
        "categoria" categoria_enum,
        "audiencia" audiencia_enum,
        "fecha_inicio" date NOT NULL,
        "fecha_fin" date NOT NULL,
        "activa" boolean NOT NULL DEFAULT true,
        CONSTRAINT "fk_ofertas_producto" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_ofertas_activa" ON "ofertas" ("activa")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_ofertas_producto_id" ON "ofertas" ("producto_id")`,
    );

    // ---------- pedidos ----------
    await queryRunner.query(`
      CREATE TABLE "pedidos" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "numero_pedido" varchar(30) NOT NULL,
        "usuario_id" uuid NOT NULL,
        "subtotal" numeric(10,2) NOT NULL,
        "costo_envio" numeric(10,2) NOT NULL,
        "total" numeric(10,2) NOT NULL,
        "envio_nombre_completo" varchar(150) NOT NULL,
        "envio_direccion" varchar(255) NOT NULL,
        "envio_ciudad" varchar(100) NOT NULL,
        "envio_codigo_postal" varchar(10) NOT NULL,
        "envio_telefono" varchar(20) NOT NULL,
        "metodo_pago" metodo_pago_enum NOT NULL,
        "estado" estado_pedido_enum NOT NULL DEFAULT 'pendiente',
        "estado_pago" estado_pago_enum NOT NULL DEFAULT 'pendiente',
        "envio_paqueteria" varchar(60),
        "envio_id_skydropx" varchar(120),
        "envio_numero_guia" varchar(120),
        "envio_url_etiqueta" varchar(500),
        "envio_url_rastreo" varchar(500),
        "envio_fecha_envio" timestamptz,
        "fecha" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_pedidos_numero_pedido" UNIQUE ("numero_pedido"),
        CONSTRAINT "fk_pedidos_usuario" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_pedidos_usuario_id" ON "pedidos" ("usuario_id")`,
    );

    // ---------- items_pedido ----------
    await queryRunner.query(`
      CREATE TABLE "items_pedido" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "pedido_id" uuid NOT NULL,
        "producto_id" uuid NOT NULL,
        "talla" talla_enum NOT NULL,
        "color" color_enum NOT NULL,
        "cantidad" integer NOT NULL,
        "precio_unitario" numeric(10,2) NOT NULL,
        CONSTRAINT "fk_items_pedido_pedido" FOREIGN KEY ("pedido_id") REFERENCES "pedidos" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_items_pedido_producto" FOREIGN KEY ("producto_id") REFERENCES "productos" ("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_items_pedido_pedido_id" ON "items_pedido" ("pedido_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_items_pedido_producto_id" ON "items_pedido" ("producto_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "items_pedido"`);
    await queryRunner.query(`DROP TABLE "pedidos"`);
    await queryRunner.query(`DROP TABLE "ofertas"`);
    await queryRunner.query(`DROP TABLE "favoritos"`);
    await queryRunner.query(`DROP TABLE "direcciones"`);
    await queryRunner.query(`DROP TABLE "productos"`);
    await queryRunner.query(`DROP TABLE "usuarios"`);

    await queryRunner.query(`DROP TYPE "aplica_a_enum"`);
    await queryRunner.query(`DROP TYPE "tipo_descuento_enum"`);
    await queryRunner.query(`DROP TYPE "metodo_pago_enum"`);
    await queryRunner.query(`DROP TYPE "estado_pago_enum"`);
    await queryRunner.query(`DROP TYPE "estado_pedido_enum"`);
    await queryRunner.query(`DROP TYPE "etiqueta_enum"`);
    await queryRunner.query(`DROP TYPE "color_enum"`);
    await queryRunner.query(`DROP TYPE "talla_enum"`);
    await queryRunner.query(`DROP TYPE "audiencia_enum"`);
    await queryRunner.query(`DROP TYPE "categoria_enum"`);
    await queryRunner.query(`DROP TYPE "rol_usuario_enum"`);
  }
}
