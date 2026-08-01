import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { CrearDireccionDto } from './dto/crear-direccion.dto';
import { ActualizarDireccionDto } from './dto/actualizar-direccion.dto';
import { Direccion } from '../../entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Controller('direcciones')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  listar(@CurrentUser() usuario: AuthenticatedUser): Promise<Direccion[]> {
    return this.addressesService.listar(usuario.id);
  }

  @Get(':id')
  obtenerUna(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<Direccion> {
    return this.addressesService.obtenerUnaDelUsuario(id, usuario.id);
  }

  @Post()
  crear(
    @Body() dto: CrearDireccionDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<Direccion> {
    return this.addressesService.crear(usuario.id, dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarDireccionDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<Direccion> {
    return this.addressesService.actualizar(id, usuario.id, dto);
  }

  @Delete(':id')
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<void> {
    return this.addressesService.eliminar(id, usuario.id);
  }
}
