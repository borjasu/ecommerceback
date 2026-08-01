import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ActualizarPerfilDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d\s+()-]{7,20}$/, { message: 'Ingresa un teléfono válido.' })
  telefono?: string;
}
