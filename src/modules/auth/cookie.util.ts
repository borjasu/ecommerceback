import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';

const MS_POR_SEGUNDO = 1000;
const MS_POR_MINUTO = 60 * MS_POR_SEGUNDO;
const MS_POR_HORA = 60 * MS_POR_MINUTO;
const MS_POR_DIA = 24 * MS_POR_HORA;

function opcionesBase(config: ConfigService): CookieOptions {
  const dominio = config.get<string>('COOKIE_DOMAIN');
  // Configurable por entorno (default 'lax', ver env.validation.ts) en vez de
  // 'strict' fijo: mientras frontend (Vercel) y backend (Railway) no
  // compartan dominio propio, son sites distintos para el navegador y
  // 'strict' (igual que 'lax') haría que la cookie de sesión nunca viajara en
  // esas peticiones cross-site — el login parecería funcionar pero ninguna
  // petición protegida posterior la traería. Railway debe tener
  // COOKIE_SAME_SITE=none (exige secure:true, ya garantizado abajo en
  // producción) hasta que haya un dominio propio compartido (ej.
  // app.frankjeans.com + api.frankjeans.com), momento en el que debe volver
  // a 'strict'.
  const sameSite = config.get<string>('COOKIE_SAME_SITE') as
    | 'strict'
    | 'lax'
    | 'none';
  return {
    httpOnly: true,
    secure: config.get<string>('NODE_ENV') === 'production',
    sameSite,
    path: '/',
    ...(dominio ? { domain: dominio } : {}),
  };
}

export function fijarCookiesDeSesion(
  response: Response,
  config: ConfigService,
  accessToken: string,
  refreshToken: string,
): void {
  const base = opcionesBase(config);
  response.cookie('access_token', accessToken, {
    ...base,
    maxAge: 15 * MS_POR_MINUTO,
  });
  response.cookie('refresh_token', refreshToken, {
    ...base,
    maxAge: 7 * MS_POR_DIA,
    path: '/auth/refresh',
  });
}

export function limpiarCookiesDeSesion(
  response: Response,
  config: ConfigService,
): void {
  const base = opcionesBase(config);
  response.clearCookie('access_token', base);
  response.clearCookie('refresh_token', { ...base, path: '/auth/refresh' });
}
