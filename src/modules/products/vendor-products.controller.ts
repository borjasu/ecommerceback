import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { VendorProductsService } from './vendor-products.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { ProductoPlano } from './producto-con-precio.mapper';
import { RolUsuario } from '../../entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// Mismo path /productos que ProductsController (público, solo lectura) — Nest
// no tiene problema en repartir un mismo prefijo entre dos controladores
// mientras no colisionen método+ruta exacta. Este solo tiene los verbos de
// escritura, todos detrás de @Roles('vendedor').
@Controller('productos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.VENDEDOR)
export class VendorProductsController {
  constructor(private readonly vendorProductsService: VendorProductsService) {}

  @Post()
  crear(@Body() dto: CrearProductoDto): Promise<ProductoPlano> {
    return this.vendorProductsService.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarProductoDto,
  ): Promise<ProductoPlano> {
    return this.vendorProductsService.actualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.vendorProductsService.eliminar(id);
  }
}
