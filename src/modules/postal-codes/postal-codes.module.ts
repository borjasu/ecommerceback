import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodigoPostal } from '../../entities';
import { PostalCodesController } from './postal-codes.controller';
import { PostalCodesService } from './postal-codes.service';

@Module({
  imports: [TypeOrmModule.forFeature([CodigoPostal])],
  controllers: [PostalCodesController],
  providers: [PostalCodesService],
})
export class PostalCodesModule {}
