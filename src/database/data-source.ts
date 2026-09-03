import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import {
  Usuario,
  Producto,
  Direccion,
  Favorito,
  Oferta,
  Pedido,
  ItemPedido,
  PedidoAuditoria,
  Color,
  Talla,
  MensajeContacto,
  ProductoColorImagen,
} from '../entities';

config();

/**
 * DataSource usado exclusivamente por el CLI de TypeORM (migration:generate,
 * migration:run, migration:revert) — la app en runtime usa TypeOrmModule.forRootAsync
 * en database.module.ts, que lee la config vía @nestjs/config en vez de dotenv directo.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    Usuario,
    Producto,
    Direccion,
    Favorito,
    Oferta,
    Pedido,
    ItemPedido,
    PedidoAuditoria,
    Color,
    Talla,
    MensajeContacto,
    ProductoColorImagen,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
