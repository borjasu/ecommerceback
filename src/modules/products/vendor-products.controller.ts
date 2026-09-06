import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { VendorProductsService } from './vendor-products.service';
import { ProductoColorImagenesService } from './producto-color-imagenes.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { SubirFotoColorDto } from './dto/subir-foto-color.dto';
import { ProductoPlano } from './producto-con-precio.mapper';
import { ProductoColorImagenPlano } from './producto-color-imagen.mapper';
import { RolUsuario } from '../../entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// memoryStorage (no diskStorage de multer): ProductoColorImagenesService es
// quien decide el nombre final del archivo (uuid propio + extensión validada
// contra el mimetype) y lo escribe a disco él mismo — aquí solo se necesita
// el buffer en memoria de camino al servicio. 10MB igual que el límite de
// body JSON de la imagen general (ver main.ts), para no dar un tope más
// permisivo a esta subida que a la otra.
const LIMITE_FOTO_COLOR_BYTES = 10 * 1024 * 1024;

// Mismo path /productos que ProductsController (público, solo lectura) — Nest
// no tiene problema en repartir un mismo prefijo entre dos controladores
// mientras no colisionen método+ruta exacta. Este solo tiene los verbos de
// escritura, todos detrás de @Roles('vendedor').
@Controller('productos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.VENDEDOR)
export class VendorProductsController {
  constructor(
    private readonly vendorProductsService: VendorProductsService,
    private readonly productoColorImagenesService: ProductoColorImagenesService,
  ) {}

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

  // Foto real del color, subida por el vendedor (multipart/form-data, no
  // JSON: por eso este handler no puede usar el DTO como único @Body() —
  // ver SubirFotoColorDto para los campos de texto). Límite propio más
  // generoso que el throttler default: al guardar un producto con varios
  // colores marcados, el frontend sube una foto por color en llamadas
  // sucesivas justo después de crear/actualizar el producto.
  @Post(':id/colores')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: memoryStorage(),
      limits: { fileSize: LIMITE_FOTO_COLOR_BYTES },
    }),
  )
  subirFotoColor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubirFotoColorDto,
    @UploadedFile() foto: Express.Multer.File | undefined,
  ): Promise<ProductoColorImagenPlano> {
    if (!foto) {
      // FileInterceptor no rechaza solo porque falte el archivo (el campo
      // 'foto' es opcional para multer si el cliente no lo manda) —
      // ProductoColorImagenesService también lo valida, pero fallar aquí da
      // un mensaje más directo sin ni siquiera tocar la BD.
      throw new BadRequestException('Falta la foto del color.');
    }
    return this.productoColorImagenesService.subirFoto(id, dto, foto);
  }

  @Delete(':id/colores/:colorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarColor(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('colorId', ParseUUIDPipe) colorId: string,
  ): Promise<void> {
    return this.productoColorImagenesService.eliminar(id, colorId);
  }
}
