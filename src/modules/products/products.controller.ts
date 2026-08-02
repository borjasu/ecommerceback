import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ProductsService,
  PaginaDeProductos,
  FiltrosDisponibles,
} from './products.service';
import {
  ListarProductosQueryDto,
  BuscarProductosQueryDto,
} from './dto/listar-productos-query.dto';
import { ProductoConPrecio } from './producto-con-precio.mapper';

// Público a propósito: sin JwtAuthGuard — el catálogo debe verse sin sesión.
// El módulo vendedor añade, en su propio controlador, los endpoints de escritura
// (POST/PATCH/DELETE) protegidos con @UseGuards(JwtAuthGuard, RolesGuard) y @Roles('vendedor'),
// sobre la misma entidad Producto — no se tocan aquí.
@Controller('productos')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('buscar')
  buscar(@Query() query: BuscarProductosQueryDto): Promise<PaginaDeProductos> {
    return this.productsService.buscar(query);
  }

  @Get('destacados')
  destacados(): Promise<ProductoConPrecio[]> {
    return this.productsService.destacados();
  }

  // Rutas literales ('buscar', 'destacados', 'filtros-disponibles') SIEMPRE
  // antes de ':id' — si quedara después, Nest la matchearía como si
  // "filtros-disponibles" fuera un id (y ParseUUIDPipe la rechazaría con 400).
  @Get('filtros-disponibles')
  filtrosDisponibles(): Promise<FiltrosDisponibles> {
    return this.productsService.filtrosDisponibles();
  }

  @Get(':id')
  obtenerPorId(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductoConPrecio> {
    return this.productsService.obtenerPorId(id);
  }

  @Get()
  listar(@Query() query: ListarProductosQueryDto): Promise<PaginaDeProductos> {
    return this.productsService.listar(query);
  }
}
