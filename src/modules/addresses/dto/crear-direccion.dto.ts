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
  @MinLength(2)
  @MaxLength(200)
  calle: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  numeroExterior: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeroInterior?: string;

  // Estado/municipio/colonia: SIEMPRE los que devolvió GET /codigos-postales/:cp
  // para ese CP (o los que el comprador tecleó a mano si el catálogo no cubre
  // ese CP, ver auditoría del prompt) — nunca se validan aquí contra el
  // catálogo en el backend, así un hueco de cobertura real nunca bloquea el
  // checkout.
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  colonia: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  municipio: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  estado: string;

  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'Ingresa un código postal válido.' })
  codigoPostal: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  referencias?: string;

  @IsString()
  @Matches(/^[\d\s+()-]{7,20}$/, { message: 'Ingresa un teléfono válido.' })
  telefono: string;

  @IsOptional()
  @IsBoolean()
  predeterminada?: boolean;
}
