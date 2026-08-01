import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Oferta, Producto } from '../../entities';
import { OffersService } from './offers.service';
import { OffersAdminService } from './offers-admin.service';
import { OffersController } from './offers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Oferta, Producto])],
  controllers: [OffersController],
  providers: [OffersService, OffersAdminService],
  exports: [OffersService],
})
export class OffersModule {}
