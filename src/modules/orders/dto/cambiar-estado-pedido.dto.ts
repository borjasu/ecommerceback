import { IsEnum } from 'class-validator';
import { EstadoPedido } from '../../../entities';

export class CambiarEstadoPedidoDto {
  @IsEnum(EstadoPedido)
  estado: EstadoPedido;
}
