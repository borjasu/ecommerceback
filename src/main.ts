import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

// El body-parser JSON que Nest monta por defecto viene con límite de 100kb
// (heredado de body-parser/express). El formulario de "crear producto" manda
// la imagen como data URI base64 dentro del mismo JSON (no hay endpoint de
// subida de archivos todavía) — cualquier foto real, ya en base64, supera esas
// 100kb con facilidad y el request entero se rechaza con PayloadTooLargeError
// ANTES de llegar al controller (por eso el 500 no traía ningún detalle de
// negocio: nunca llegó a ejecutarse el servicio ni el ValidationPipe).
// Se desactiva el parser default y se define uno propio con un límite acorde
// a una imagen de producto en base64 (~10MB de sobra para una foto de varios MB).
const LIMITE_BODY_JSON = '10mb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: LIMITE_BODY_JSON }));
  app.use(urlencoded({ extended: true, limit: LIMITE_BODY_JSON }));

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
