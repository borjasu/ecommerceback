import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Direccion, Pedido, Producto } from '../../entities';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { SkydropxClientService } from './skydropx-client.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Direccion, Producto, Pedido]),
    // 10s (el default anterior) es corto incluso para UNA sola llamada de red
    // a Skydropx con OAuth incluido — verificado en vivo: "timeout of 10000ms
    // exceeded" ocurría con cierta frecuencia contra el sandbox real.
    HttpModule.register({ timeout: 25000 }),
  ],
  controllers: [ShippingController],
  providers: [ShippingService, SkydropxClientService],
  exports: [ShippingService],
})
export class ShippingModule {}
