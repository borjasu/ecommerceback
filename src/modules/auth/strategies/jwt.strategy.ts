import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface';
import { RolUsuario } from '../../../entities';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  rol: RolUsuario;
}

/**
 * Extrae el access token de la cookie HttpOnly `access_token` — nunca de un header.
 * `req.cookies` viene tipado por la aumentación ambiental de @types/cookie-parser
 * sobre `Express.Request` (por eso no hace falta declararlo aquí de nuevo).
 */
function extractorDeCookie(req: Request): string | null {
  const valor = req.cookies?.access_token as string | undefined;
  return valor ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: extractorDeCookie,
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    } as StrategyOptionsWithRequest);
  }

  validate(payload: JwtAccessPayload): AuthenticatedUser {
    return { id: payload.sub, email: payload.email, rol: payload.rol };
  }
}
