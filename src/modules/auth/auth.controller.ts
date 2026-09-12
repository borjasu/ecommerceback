import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegistroDto } from './dto/registro.dto';
import { LoginDto } from './dto/login.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { fijarCookiesDeSesion, limpiarCookiesDeSesion } from './cookie.util';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

// Todas sobreescriben el throttler "default" para SU ruta específica (ver
// nota en app.module.ts) — cada una tiene su propio contador aislado por
// handler, así que nunca compiten por cupo entre sí.
//
// @Throttle() exige valores literales evaluados al cargar el módulo (es
// metadata de decorador, corre antes de que exista el contenedor de DI) —
// por eso se lee process.env directo aquí en vez de ConfigService, igual que
// hace src/database/data-source.ts para el mismo tipo de restricción. Los
// defaults (5/60000) igualan lo que antes estaba fijo, así que sin las env
// vars el comportamiento no cambia.
const THROTTLE_CREDENCIALES = {
  default: {
    limit: Number(process.env.THROTTLE_AUTH_LIMIT) || 5,
    ttl: Number(process.env.THROTTLE_AUTH_TTL) || 60000,
  },
};

// /auth/refresh lo dispara automáticamente el interceptor de refresco del
// frontend cada vez que una petición protegida da 401 (recargar la página,
// varias pestañas, etc.) — necesita más margen que un intento de login manual,
// que es una acción explícita del usuario y debe seguir estricto.
const THROTTLE_REFRESH = {
  default: { limit: 10, ttl: 60000 },
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('registro')
  @Throttle(THROTTLE_CREDENCIALES)
  @HttpCode(HttpStatus.CREATED)
  async registro(
    @Body() dto: RegistroDto,
  ): Promise<{ id: string; nombre: string; email: string; rol: string }> {
    const usuario = await this.authService.registro(dto);
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    };
  }

  @Post('login')
  @Throttle(THROTTLE_CREDENCIALES)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: string; nombre: string; email: string; rol: string }> {
    const { usuario, tokens } = await this.authService.login(dto);
    fijarCookiesDeSesion(
      res,
      this.config,
      tokens.accessToken,
      tokens.refreshToken,
    );
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    };
  }

  @Post('refresh')
  @Throttle(THROTTLE_REFRESH)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ id: string; nombre: string; email: string; rol: string }> {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    const { usuario, tokens } = await this.authService.refrescar(refreshToken);
    fijarCookiesDeSesion(
      res,
      this.config,
      tokens.accessToken,
      tokens.refreshToken,
    );
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() usuario: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(usuario.id);
    limpiarCookiesDeSesion(res, this.config);
  }

  @Patch('cambiar-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async cambiarPassword(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: CambiarPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.cambiarPassword(usuario.id, dto);
    // Invalida también la sesión actual: obliga a loguearse de nuevo con la
    // contraseña nueva en este mismo dispositivo.
    limpiarCookiesDeSesion(res, this.config);
  }
}
