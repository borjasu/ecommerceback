import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { EstadoPago, EstadoPedido } from '../../../entities';

const LIMITE_MAXIMO = 200;
const LIMITE_DEFAULT = 50;

export class ListarPedidosVendedorQueryDto {
  @IsOptional()
  @IsEnum(EstadoPedido)
  estado?: EstadoPedido;

  @IsOptional()
  @IsEnum(EstadoPago)
  estadoPago?: EstadoPago;

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  // Tope duro: sin esto, GET /vendedor/pedidos?limit=999999 sería un vector
  // trivial de DoS por consulta sin límite conforme la tabla crezca.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO)
  limit: number = LIMITE_DEFAULT;
}
