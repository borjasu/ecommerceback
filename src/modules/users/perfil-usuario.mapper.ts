import { Usuario } from '../../entities';

export interface PerfilUsuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  telefono: string | null;
  fechaRegistro: Date;
}

/**
 * Mapper explícito (además de @Exclude() en la entidad): nunca dejamos que un
 * Usuario completo salga por un controlador, ni por accidente si alguien
 * olvida el interceptor de serialización en el futuro.
 */
export function aPerfilUsuario(usuario: Usuario): PerfilUsuario {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    telefono: usuario.telefono,
    fechaRegistro: usuario.fechaRegistro,
  };
}
