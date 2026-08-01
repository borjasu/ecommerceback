import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Audiencia, Categoria, Etiqueta } from '../../../entities';

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

  // Nombres del catálogo dinámico de colores/tallas (modules/catalogos), no un
  // enum fijo: VendorProductsService valida contra la BD que cada nombre
  // exista y esté activo antes de guardar (ColoresService/TallasService
  // .resolverActivosPorNombre) — aquí solo se valida la forma del array.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  coloresDisponibles: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  tallasDisponibles: string[];

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
