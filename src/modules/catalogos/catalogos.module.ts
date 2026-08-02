import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Color, Talla } from '../../entities';
import { ColoresController } from './colores.controller';
import { ColoresService } from './colores.service';
import { TallasController } from './tallas.controller';
import { TallasService } from './tallas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Color, Talla])],
  controllers: [ColoresController, TallasController],
  providers: [ColoresService, TallasService],
  // Exportados para que ProductsModule (VendorProductsService) resuelva
  // nombres de color/talla a entidades activas al crear/actualizar un producto.
  exports: [ColoresService, TallasService],
})
export class CatalogosModule {}
