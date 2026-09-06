import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemPedido, Producto, ProductoColorImagen } from '../../entities';
import { OffersModule } from '../offers/offers.module';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { VendorProductsController } from './vendor-products.controller';
import { VendorProductsService } from './vendor-products.service';
import { ProductoColorImagenesService } from './producto-color-imagenes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Producto, ItemPedido, ProductoColorImagen]),
    OffersModule,
    CatalogosModule,
  ],
  controllers: [ProductsController, VendorProductsController],
  providers: [ProductsService, VendorProductsService, ProductoColorImagenesService],
  exports: [ProductsService],
})
export class ProductsModule {}
