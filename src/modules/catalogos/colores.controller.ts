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
import { ColoresService } from './colores.service';
import { CrearColorDto } from './dto/crear-color.dto';
import { ActualizarColorDto } from './dto/actualizar-color.dto';
import { Color, RolUsuario } from '../../entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('colores')
export class ColoresController {
  constructor(private readonly coloresService: ColoresService) {}

  // Público: solo colores activos, para los selectores del catálogo/producto
  // del lado cliente.
  @Get()
  listarActivos(): Promise<Color[]> {
    return this.coloresService.listarActivos();
  }

  // Panel vendedor: activos e inactivos, para poder reactivar uno desactivado.
  @Get('todos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.VENDEDOR)
  listarTodos(): Promise<Color[]> {
    return this.coloresService.listarTodos();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.VENDEDOR)
  crear(@Body() dto: CrearColorDto): Promise<Color> {
    return this.coloresService.crear(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.VENDEDOR)
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarColorDto,
  ): Promise<Color> {
    return this.coloresService.actualizar(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.VENDEDOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.coloresService.eliminar(id);
  }
}
