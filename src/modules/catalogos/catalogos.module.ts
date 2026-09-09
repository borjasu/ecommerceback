import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categoria, Color, Producto, Talla } from '../../entities';
import { ColoresController } from './colores.controller';
import { ColoresService } from './colores.service';
import { TallasController } from './tallas.controller';
import { TallasService } from './tallas.service';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';

@Module({
  // Producto se registra aquí (además de en ProductsModule) solo para que
  // CategoriasService pueda contar productos por categoría al validar un
  // DELETE — es la misma tabla, TypeORM permite registrar una entidad en
  // más de un módulo sin conflicto.
  imports: [TypeOrmModule.forFeature([Color, Talla, Categoria, Producto])],
  controllers: [ColoresController, TallasController, CategoriasController],
  providers: [ColoresService, TallasService, CategoriasService],
  // Exportados para que ProductsModule (VendorProductsService) resuelva
  // nombres de color/talla/categoría a entidades/valores vigentes al
  // crear/actualizar un producto.
  exports: [ColoresService, TallasService, CategoriasService],
})
export class CatalogosModule {}
