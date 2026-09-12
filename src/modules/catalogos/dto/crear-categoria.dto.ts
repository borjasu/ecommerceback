import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, MaxLength, MinLength } from 'class-validator';
import { ICONOS_CATEGORIA_VALIDOS } from '../constants/iconos-categoria';

export class CrearCategoriaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre: string;

  @IsIn(ICONOS_CATEGORIA_VALIDOS)
  icono: string;

  // Determina el orden de despliegue en el menú/selectores — mismo criterio
  // que CrearTallaDto.orden (el frontend calcula "siguiente" = máximo + 1).
  @Type(() => Number)
  @IsInt()
  orden: number;
}
