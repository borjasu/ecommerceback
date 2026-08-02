import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MensajeContacto } from '../../entities';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  imports: [TypeOrmModule.forFeature([MensajeContacto])],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
