import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const nodeEnv = config.get<string>('NODE_ENV');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // El propio catálogo sirve imágenes de producto desde afuera (picsum en
          // mocks/seed) — en producción esto debe limitarse al dominio real del
          // bucket de imágenes, no dejarse abierto.
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      frameguard: { action: 'deny' },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(cookieParser());

  // Whitelist explícita del frontend — nunca origin: '*', y credentials: true es
  // obligatorio para que la cookie HttpOnly del JWT viaje en requests cross-origin.
  // Admite una lista separada por comas en CORS_ORIGIN (p. ej. localhost y 127.0.0.1
  // del mismo dev server): el navegador los trata como orígenes distintos aunque
  // apunten a la misma máquina, así que un match exacto de un solo string no basta.
  const corsOrigins = config
    .get<string>('CORS_ORIGIN')!
    .split(',')
    .map((origen) => origen.trim());

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // HttpExceptionFilter va registrado como APP_FILTER en AppModule (no aquí),
  // así que también cubre errores lanzados durante el bootstrap de guards/pipes.

  if (nodeEnv !== 'production') {
    const documento = new DocumentBuilder()
      .setTitle('Frank Jeans API — lado cliente')
      .setDescription(
        'Catálogo, carrito/checkout, cuenta, envíos y pagos del comprador.',
      )
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, documento);
    SwaggerModule.setup('docs', app, swaggerDocument);
  }

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
}

void bootstrap();
