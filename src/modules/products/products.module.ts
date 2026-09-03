import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ItemPedido, Producto, ProductoColorImagen } from '../../entities';
import { OffersModule } from '../offers/offers.module';
import { CatalogosModule } from '../catalogos/catalogos.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { VendorProductsController } from './vendor-products.controller';
import { VendorProductsService } from './vendor-products.service';
import { ProductoColorImagenesService } from './producto-color-imagenes.service';
import { RecoloreoService } from './recoloreo/recoloreo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Producto, ItemPedido, ProductoColorImagen]),
    OffersModule,
    CatalogosModule,
    // Timeout generoso: descargar la imagen base de un producto (fetch por
    // URL, ver imagen-origen.util.ts) puede tardar más que una llamada de
    // API típica si el host externo es lento.
    HttpModule.register({ timeout: 20000 }),
  ],
  controllers: [ProductsController, VendorProductsController],
  providers: [
    ProductsService,
    VendorProductsService,
    ProductoColorImagenesService,
    RecoloreoService,
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
