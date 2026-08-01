import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RolUsuario } from './enums';
import { Direccion } from './direccion.entity';
import { Pedido } from './pedido.entity';
import { Favorito } from './favorito.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  // select: false evita que cualquier find() lo traiga por accidente; hay que pedirlo
  // explícitamente con .addSelect() (solo en AuthService, al validar login).
  // @Exclude() es la segunda barrera: si alguna vez se serializa la entidad completa
  // (p. ej. un find() sin querybuilder que sí incluya el hash), class-transformer lo quita.
  @Column({ type: 'varchar', name: 'password_hash', select: false })
  @Exclude()
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: RolUsuario,
    enumName: 'rol_usuario_enum',
    default: RolUsuario.COMPRADOR,
  })
  rol: RolUsuario;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @CreateDateColumn({ name: 'fecha_registro' })
  fechaRegistro: Date;

  // Contador de "generación" de refresh tokens. Cada login/refresh emite un token
  // con este valor embebido (claim `tv`); al rotar se incrementa y se emite uno nuevo,
  // así que cualquier refresh token viejo (robado o no) deja de ser válido de inmediato.
  // No forma parte del modelo de negocio pedido explícitamente, pero es indispensable
  // para que "refresh token rotation" sea real y no solo cosmético.
  @Column({ type: 'int', name: 'refresh_token_version', default: 0 })
  @Exclude()
  refreshTokenVersion: number;

  @OneToMany(() => Direccion, (direccion) => direccion.usuario)
  direcciones: Direccion[];

  @OneToMany(() => Pedido, (pedido) => pedido.usuario)
  pedidos: Pedido[];

  @OneToMany(() => Favorito, (favorito) => favorito.usuario)
  favoritos: Favorito[];
}
