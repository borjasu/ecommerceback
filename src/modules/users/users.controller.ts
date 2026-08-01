import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { ActualizarPerfilDto } from './dto/actualizar-perfil.dto';
import { aPerfilUsuario, PerfilUsuario } from './perfil-usuario.mapper';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

// Nunca recibe :id en la URL — siempre opera sobre el usuario del JWT.
// Elimina por completo la superficie de IDOR en este controlador: no hay
// forma de pedir el perfil de otra persona cambiando un parámetro.
@Controller('usuarios')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('perfil')
  async perfil(
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<PerfilUsuario> {
    const encontrado = await this.usersService.buscarPorId(usuario.id);
    return aPerfilUsuario(encontrado);
  }

  @Patch('perfil')
  async actualizarPerfil(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: ActualizarPerfilDto,
  ): Promise<PerfilUsuario> {
    const actualizado = await this.usersService.actualizarPerfil(
      usuario.id,
      dto,
    );
    return aPerfilUsuario(actualizado);
  }
}
