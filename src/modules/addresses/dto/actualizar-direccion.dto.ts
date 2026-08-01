import { PartialType } from '@nestjs/swagger';
import { CrearDireccionDto } from './crear-direccion.dto';

export class ActualizarDireccionDto extends PartialType(CrearDireccionDto) {}
