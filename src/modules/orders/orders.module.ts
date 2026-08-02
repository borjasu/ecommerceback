import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Direccion,
  ItemPedido,
  Pedido,
  PedidoAuditoria,
  Producto,
} from '../../entities';
import { OffersModule } from '../offers/offers.module';
import { ShippingModule } from '../shipping/shipping.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersCleanupService } from './orders-cleanup.service';
import { VendorOrdersController } from './vendor-orders.controller';
import { VendorOrdersService } from './vendor-orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pedido,
      ItemPedido,
      Direccion,
      Producto,
      PedidoAuditoria,
    ]),
    OffersModule,
    ShippingModule,
  ],
  controllers: [OrdersController, VendorOrdersController],
  providers: [OrdersService, VendorOrdersService, OrdersCleanupService],
  exports: [OrdersService],
})
export class OrdersModule {}
