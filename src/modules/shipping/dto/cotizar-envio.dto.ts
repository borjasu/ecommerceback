import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Color, Talla } from '../../../entities';

export class ItemCotizacionDto {
  @IsUUID()
  productoId: string;

  @IsEnum(Talla)
  talla: Talla;

  @IsEnum(Color)
  color: Color;

  @IsInt()
  @Min(1)
  cantidad: number;
}

export class CotizarEnvioDto {
  @IsUUID()
  direccionId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemCotizacionDto)
  items: ItemCotizacionDto[];
}
