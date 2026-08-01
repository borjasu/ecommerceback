import { PartialType } from '@nestjs/swagger';
import { CrearTallaDto } from './crear-talla.dto';

export class ActualizarTallaDto extends PartialType(CrearTallaDto) {}
