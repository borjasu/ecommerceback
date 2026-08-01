import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { OffersModule } from './modules/offers/offers.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      // falla rápido si falta o es inválida cualquier variable requerida
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('THROTTLE_TTL')!,
            limit: config.get<number>('THROTTLE_LIMIT')!,
          },
          {
            name: 'auth',
            ttl: config.get<number>('THROTTLE_AUTH_TTL')!,
            limit: config.get<number>('THROTTLE_AUTH_LIMIT')!,
          },
          {
            // Cotizar envío puede tener costo/cuota del lado de Skydropx — límite
            // propio más estricto que el global, aparte del de auth.
            name: 'shipping',
            ttl: 60000,
            limit: 10,
          },
        ],
      }),
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    OffersModule,
    ProductsModule,
    AddressesModule,
    FavoritesModule,
    ShippingModule,
    OrdersModule,
    PaymentsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
