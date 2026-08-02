import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Talla/color no afectan el cálculo de envío (solo cantidad/producto para
// peso y dimensiones) — se validan como string simple, ya no como enum fijo,
// consistente con modules/catalogos.
export class ItemCotizacionDto {
  @IsUUID()
  productoId: string;

  @IsString()
  @MaxLength(20)
  talla: string;

  @IsString()
  @MaxLength(60)
  color: string;

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
