import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';
import { Categoria, RolUsuario } from '../../entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  // Público — no hay concepto de "inactiva" (ver entities/categoria.entity.ts),
  // así que a diferencia de colores/tallas no hace falta un GET /todos aparte
  // para el panel de vendedor: es la misma lista para todos.
  @Get()
  listarTodas(): Promise<Categoria[]> {
    return this.categoriasService.listarTodas();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.VENDEDOR)
  crear(@Body() dto: CrearCategoriaDto): Promise<Categoria> {
    return this.categoriasService.crear(dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.VENDEDOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.categoriasService.eliminar(id);
  }
}
