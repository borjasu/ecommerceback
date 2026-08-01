import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

interface RequestConUsuario extends Request {
  user: AuthenticatedUser;
}

/** Inyecta el usuario autenticado (extraído del JWT por JwtAuthGuard) en el handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestConUsuario>();
    return request.user;
  },
);
