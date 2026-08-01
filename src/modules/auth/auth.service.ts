import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { StringValue } from 'ms';
import { Usuario, RolUsuario } from '../../entities';
import { RegistroDto } from './dto/registro.dto';
import { LoginDto } from './dto/login.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';

const BCRYPT_COST_FACTOR = 12;
const MENSAJE_CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos.';

export interface ParDeTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async registro(dto: RegistroDto): Promise<Usuario> {
    const existente = await this.usuarios.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existente) {
      // Aquí sí es aceptable distinguir el caso (a diferencia de login): en un
      // flujo de registro, decirle a alguien "ese correo ya existe" es el
      // comportamiento normal de cualquier formulario de alta y no habilita
      // enumeración útil de cuentas ajenas (no revela nada sobre credenciales).
      throw new ConflictException(
        'Ya existe una cuenta con ese correo electrónico.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST_FACTOR);

    // dto.rol se ignora por completo a propósito — el rol de un registro público
    // SIEMPRE es 'comprador', sin importar qué venga en el body.
    const nuevoUsuario = this.usuarios.create({
      nombre: dto.nombre,
      email: dto.email.toLowerCase(),
      passwordHash,
      rol: RolUsuario.COMPRADOR,
    });

    return this.usuarios.save(nuevoUsuario);
  }

  async login(
    dto: LoginDto,
  ): Promise<{ usuario: Usuario; tokens: ParDeTokens }> {
    const usuario = await this.usuarios.findOne({
      where: { email: dto.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        passwordHash: true,
        refreshTokenVersion: true,
      },
    });

    // Mismo mensaje genérico exista o no el usuario, y aunque la contraseña esté mal:
    // evita enumeración de cuentas por diferencia de respuesta (OWASP A07).
    if (!usuario) {
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    const passwordValido = await bcrypt.compare(
      dto.password,
      usuario.passwordHash,
    );
    if (!passwordValido) {
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    const tokens = await this.emitirTokens(usuario);
    return { usuario, tokens };
  }

  async refrescar(
    refreshToken: string | undefined,
  ): Promise<{ usuario: Usuario; tokens: ParDeTokens }> {
    if (!refreshToken) {
      throw new UnauthorizedException('No hay sesión que refrescar.');
    }

    let payload: { sub: string; tv: number };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    const usuario = await this.usuarios.findOne({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        refreshTokenVersion: true,
      },
    });

    // El claim `tv` debe coincidir EXACTO con el contador actual del usuario:
    // si no coincide, es un refresh token que ya fue rotado (o robado y ya usado
    // una vez) — rotation efectiva, no solo cosmética.
    if (!usuario || usuario.refreshTokenVersion !== payload.tv) {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    const tokens = await this.emitirTokens(usuario);
    return { usuario, tokens };
  }

  async logout(usuarioId: string): Promise<void> {
    // Invalida cualquier refresh token pendiente, aunque el cliente no lo mande.
    await this.usuarios.increment({ id: usuarioId }, 'refreshTokenVersion', 1);
  }

  async cambiarPassword(
    usuarioId: string,
    dto: CambiarPasswordDto,
  ): Promise<void> {
    const usuario = await this.usuarios.findOne({
      where: { id: usuarioId },
      select: { id: true, passwordHash: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Sesión inválida.');
    }

    const actualValida = await bcrypt.compare(
      dto.passwordActual,
      usuario.passwordHash,
    );
    if (!actualValida) {
      throw new BadRequestException('La contraseña actual no es correcta.');
    }

    const nuevoHash = await bcrypt.hash(dto.passwordNueva, BCRYPT_COST_FACTOR);
    // Cambiar contraseña también rota la versión de refresh token: cualquier sesión
    // abierta en otro dispositivo con la contraseña anterior queda invalidada.
    await this.usuarios.update({ id: usuarioId }, { passwordHash: nuevoHash });
    await this.usuarios.increment({ id: usuarioId }, 'refreshTokenVersion', 1);
  }

  private async emitirTokens(usuario: Usuario): Promise<ParDeTokens> {
    // Cada emisión de refresh incrementa el contador — así el token anterior
    // (el que se usó para pedir este nuevo par, si venía de /auth/refresh) queda
    // invalidado de inmediato: esto es la "rotación".
    await this.usuarios.increment({ id: usuario.id }, 'refreshTokenVersion', 1);
    const actualizado = await this.usuarios.findOne({
      where: { id: usuario.id },
      select: { id: true, refreshTokenVersion: true },
    });
    const version = actualizado?.refreshTokenVersion ?? 0;

    const accessToken = await this.jwt.signAsync(
      { sub: usuario.id, email: usuario.email, rol: usuario.rol },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        // Cast a StringValue (tipo de la librería `ms`): el valor viene de una env
        // var validada por Joi en el arranque ("15m", "7d", etc.), TS no puede
        // probar en tiempo de compilación que ese string dinámico matchea el
        // template-literal type de `ms`, pero en runtime siempre lo hace.
        expiresIn: this.config.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ) as StringValue,
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: usuario.id, tv: version },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as StringValue,
      },
    );

    return { accessToken, refreshToken };
  }
}
