import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';

const MS_POR_SEGUNDO = 1000;
const MS_POR_MINUTO = 60 * MS_POR_SEGUNDO;
const MS_POR_HORA = 60 * MS_POR_MINUTO;
const MS_POR_DIA = 24 * MS_POR_HORA;

function opcionesBase(config: ConfigService): CookieOptions {
  const dominio = config.get<string>('COOKIE_DOMAIN');
  return {
    httpOnly: true,
    secure: config.get<string>('NODE_ENV') === 'production',
    sameSite: 'strict',
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
