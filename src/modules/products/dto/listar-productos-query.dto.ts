import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Audiencia, Categoria, Color, Talla } from '../../../entities';

const LIMITE_MAXIMO = 50;
const LIMITE_DEFAULT = 20;

export class ListarProductosQueryDto {
  @IsOptional()
  @IsEnum(Audiencia)
  audiencia?: Audiencia;

  @IsOptional()
  @IsEnum(Categoria)
  categoria?: Categoria;

  @IsOptional()
  @IsEnum(Talla)
  talla?: Talla;

  @IsOptional()
  @IsEnum(Color)
  color?: Color;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precioMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precioMax?: number;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  orden?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  // Tope duro: sin esto, ?limit=999999 sería un vector trivial de DoS por
  // paginación gigante (satura memoria/CPU sirviendo todo el catálogo de golpe).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO)
  limit: number = LIMITE_DEFAULT;
}

export class BuscarProductosQueryDto {
  @IsString()
  @MaxLength(150)
  q: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO)
  limit: number = LIMITE_DEFAULT;
}
