import { RolUsuario } from '../../entities';

/** Forma del usuario autenticado, tal como lo deja JwtStrategy en request.user. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  rol: RolUsuario;
}
