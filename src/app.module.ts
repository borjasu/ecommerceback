import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { OffersModule } from './modules/offers/offers.module';
import { CatalogosModule } from './modules/catalogos/catalogos.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { PostalCodesModule } from './modules/postal-codes/postal-codes.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ContactModule } from './modules/contact/contact.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      // falla rápido si falta o es inválida cualquier variable requerida
      validationOptions: { abortEarly: false },
    }),
    // OJO con esto: cada throttler NOMBRADO que se registra aquí se evalúa en
    // TODAS las rutas de la app, no solo donde se usa @Throttle — @Throttle
    // solo sobreescribe el límite de ESE nombre en ESA ruta; en cualquier otra
    // ruta que no lo mencione, el throttler igual corre con el límite default
    // de abajo. Por eso hay un solo throttler nombrado ("default"): los límites
    // más estrictos de rutas puntuales (login, refresh, cotizar envío,
    // contacto) se logran con @Throttle({ default: { limit, ttl } }) en esa
    // ruta específica, nunca registrando un throttler nuevo — la clave de
    // rate-limit ya incluye el nombre del handler, así que cada ruta tiene su
    // propio contador aislado sin necesidad de un nombre de throttler distinto.
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
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    // Sirve las fotos por color subidas por el vendedor
    // (uploads/productos-colores/, ver ProductoColorImagenesService) bajo
    // /uploads/... — sigue sin haber backend de subida de archivos general
    // (ver src/main.ts): esto es únicamente para esas fotos.
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CatalogosModule,
    OffersModule,
    ProductsModule,
    AddressesModule,
    PostalCodesModule,
    FavoritesModule,
    ShippingModule,
    OrdersModule,
    PaymentsModule,
    ReportsModule,
    ContactModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
