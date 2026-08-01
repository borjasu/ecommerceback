import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemPedido, Producto } from '../../entities';
import { OffersModule } from '../offers/offers.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { VendorProductsController } from './vendor-products.controller';
import { VendorProductsService } from './vendor-products.service';

@Module({
  imports: [TypeOrmModule.forFeature([Producto, ItemPedido]), OffersModule],
  controllers: [ProductsController, VendorProductsController],
  providers: [ProductsService, VendorProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
