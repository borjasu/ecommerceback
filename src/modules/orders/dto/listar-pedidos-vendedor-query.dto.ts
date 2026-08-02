import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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

  // Por default (ausente o false) la vista principal NUNCA incluye pedidos
  // cancelados automáticamente por abandono (ver OrdersCleanupService) — solo
  // aparecen si se pide explícitamente esta pestaña/filtro aparte.
  // Transform explícito, no @Type(() => Boolean): un query param llega SIEMPRE
  // como string ("false"), y Boolean("false") da true en JS — sin esto,
  // ?soloAbandonados=false terminaría activando el filtro igual.
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  soloAbandonados?: boolean;

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
