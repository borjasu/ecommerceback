import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

/**
 * Valida el access token JWT extraído de la cookie HttpOnly `access_token`
 * (ver JwtStrategy — nunca lee un header Authorization, ya que este backend
 * usa cookies HttpOnly y no expone el token a JavaScript del frontend).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }
    return user;
  }

  getRequest(context: ExecutionContext): Request {
    return context.switchToHttp().getRequest<Request>();
  }
}
