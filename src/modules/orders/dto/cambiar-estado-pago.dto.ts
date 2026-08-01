import { IsEnum } from 'class-validator';
import { EstadoPago } from '../../../entities';

export class CambiarEstadoPagoDto {
  @IsEnum(EstadoPago)
  estadoPago: EstadoPago;
}
