import * as Joi from 'joi';

/**
 * Esquema de validación de variables de entorno.
 * La app falla rápido al arrancar si falta o es inválida cualquiera de estas —
 * preferible a un error críptico en tiempo de ejecución con un secreto vacío.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  COOKIE_DOMAIN: Joi.string().allow('').optional(),

  CORS_ORIGIN: Joi.string().required(),

  MERCADOPAGO_ACCESS_TOKEN: Joi.string().required(),
  MERCADOPAGO_PUBLIC_KEY: Joi.string().required(),
  MERCADOPAGO_WEBHOOK_SECRET: Joi.string().required(),

  SKYDROPX_CLIENT_ID: Joi.string().required(),
  SKYDROPX_CLIENT_SECRET: Joi.string().required(),
  SKYDROPX_ENVIRONMENT: Joi.string()
    .valid('sandbox', 'production')
    .default('sandbox'),
  SKYDROPX_API_URL: Joi.string().uri().default('https://pro.skydropx.com'),

  // Dirección física fija de la tienda (origen de todos los envíos) — Frank Jeans, Puebla.
  STORE_ORIGIN_STREET: Joi.string().required(),
  STORE_ORIGIN_POSTAL_CODE: Joi.string().required(),
  STORE_ORIGIN_CITY: Joi.string().required(),
  STORE_ORIGIN_STATE: Joi.string().required(),
  STORE_ORIGIN_NEIGHBORHOOD: Joi.string().required(),
  STORE_ORIGIN_COUNTRY_CODE: Joi.string().default('MX'),
  STORE_ORIGIN_NAME: Joi.string().required(),
  STORE_ORIGIN_PHONE: Joi.string().required(),
  STORE_ORIGIN_EMAIL: Joi.string().email().required(),

  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),
  THROTTLE_AUTH_TTL: Joi.number().default(60000),
  THROTTLE_AUTH_LIMIT: Joi.number().default(5),
});
