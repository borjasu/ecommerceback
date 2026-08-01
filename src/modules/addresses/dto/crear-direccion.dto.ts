import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CrearDireccionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  alias: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombreCompleto: string;

  @IsString()
  @MinLength(5)
  @MaxLength(255)
  direccion: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ciudad: string;

  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'Ingresa un código postal válido.' })
  codigoPostal: string;

  @IsString()
  @Matches(/^[\d\s+()-]{7,20}$/, { message: 'Ingresa un teléfono válido.' })
  telefono: string;

  @IsOptional()
  @IsBoolean()
  predeterminada?: boolean;
}
