import { PartialType } from '@nestjs/swagger';
import { CrearColorDto } from './crear-color.dto';

export class ActualizarColorDto extends PartialType(CrearColorDto) {}
