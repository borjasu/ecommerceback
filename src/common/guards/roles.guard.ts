import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { RolUsuario } from '../../entities';

/**
 * Debe usarse SIEMPRE después de JwtAuthGuard (asume que request.user ya existe).
 * Si el endpoint no tiene @Roles(), no restringe nada — cualquier usuario autenticado pasa.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<RolUsuario[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    const usuario = request.user;

    if (!usuario || !rolesPermitidos.includes(usuario.rol)) {
      throw new ForbiddenException(
        'No tienes permiso para acceder a este recurso.',
      );
    }

    return true;
  }
}
