import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearTallaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  nombre: string;

  // Determina el orden de despliegue (S/M/L/XL...) en los selectores del
  // catálogo — sin esto, mostrar las tallas en un orden lógico dependería del
  // orden alfabético o de inserción, ninguno de los dos correcto.
  @Type(() => Number)
  @IsInt()
  orden: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
