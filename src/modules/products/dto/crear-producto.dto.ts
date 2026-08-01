import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import {
  Audiencia,
  Categoria,
  Color,
  Etiqueta,
  Talla,
} from '../../../entities';

export class CrearProductoDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsString()
  descripcion: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  precio: number;

  @IsEnum(Categoria)
  categoria: Categoria;

  @IsEnum(Audiencia)
  audiencia: Audiencia;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Color, { each: true })
  coloresDisponibles: Color[];

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Talla, { each: true })
  tallasDisponibles: Talla[];

  // No se valida con @IsUrl estricto: en desarrollo/mock puede venir un data URI
  // base64 (subida de imagen sin backend de almacenamiento todavía).
  @IsString()
  imagenUrl: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagenes?: string[];

  @IsOptional()
  @IsEnum(Etiqueta)
  etiqueta?: Etiqueta | null;

  @IsOptional()
  @IsBoolean()
  destacado?: boolean;
}
