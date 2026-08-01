import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Direccion, Producto } from '../../entities';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { SkydropxClientService } from './skydropx-client.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Direccion, Producto]),
    HttpModule.register({ timeout: 10000 }),
  ],
  controllers: [ShippingController],
  providers: [ShippingService, SkydropxClientService],
  exports: [ShippingService],
})
export class ShippingModule {}
