import { PartialType } from '@nestjs/swagger';
import { CrearOfertaDto } from './crear-oferta.dto';

export class ActualizarOfertaDto extends PartialType(CrearOfertaDto) {}
