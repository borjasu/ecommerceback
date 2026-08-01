import {
  IsBoolean,
  IsHexColor,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CrearColorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre: string;

  @IsOptional()
  @IsHexColor()
  valorHex?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
