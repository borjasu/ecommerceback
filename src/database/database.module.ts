import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Usuario,
  Producto,
  Direccion,
  CodigoPostal,
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

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          Usuario,
          Producto,
          Direccion,
          CodigoPostal,
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
        migrations: ['dist/database/migrations/*.js'],
        migrationsRun: false,
        // synchronize SIEMPRE false: en dev usamos migraciones igual que en producción,
        // para que el esquema que se prueba localmente sea el mismo que se despliega.
        synchronize: false,
        logging:
          config.get<string>('NODE_ENV') === 'development'
            ? ['error', 'warn']
            : ['error'],
      }),
    }),
  ],
})
export class DatabaseModule {}
