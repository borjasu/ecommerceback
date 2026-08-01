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

const THROTTLE_AUTH = {
  auth: { limit: 5, ttl: 60000 },
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('registro')
  @Throttle(THROTTLE_AUTH)
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
  @Throttle(THROTTLE_AUTH)
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
  @Throttle(THROTTLE_AUTH)
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
