import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TallasService } from './tallas.service';
import { CrearTallaDto } from './dto/crear-talla.dto';
import { ActualizarTallaDto } from './dto/actualizar-talla.dto';
import { RolUsuario, Talla } from '../../entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('tallas')
export class TallasController {
  constructor(private readonly tallasService: TallasService) {}

  @Get()
  listarActivas(): Promise<Talla[]> {
    return this.tallasService.listarActivas();
  }

  @Get('todos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.VENDEDOR)
  listarTodas(): Promise<Talla[]> {
    return this.tallasService.listarTodas();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.VENDEDOR)
  crear(@Body() dto: CrearTallaDto): Promise<Talla> {
    return this.tallasService.crear(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.VENDEDOR)
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarTallaDto,
  ): Promise<Talla> {
    return this.tallasService.actualizar(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.VENDEDOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tallasService.eliminar(id);
  }
}
