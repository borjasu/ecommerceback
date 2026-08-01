import { PartialType } from '@nestjs/swagger';
import { CrearProductoDto } from './crear-producto.dto';

export class ActualizarProductoDto extends PartialType(CrearProductoDto) {}
