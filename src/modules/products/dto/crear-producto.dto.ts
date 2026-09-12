import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Audiencia, Etiqueta } from '../../../entities';

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

  // Categoria ya no es un enum fijo (ver modules/catalogos): se valida solo
  // la forma aquí; VendorProductsService confirma que exista de verdad en el
  // catálogo vigente antes de guardar (mismo criterio que coloresDisponibles/
  // tallasDisponibles).
  @IsString()
  @MinLength(1)
  categoria: string;

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

  // No se valida con @IsUrl estricto: sigue llegando como data URI base64
  // dentro de este mismo JSON (mismo contrato del formulario del vendedor),
  // VendorProductsService la sube a Cloudinary y reemplaza el valor por la
  // URL resultante antes de guardar — aquí solo se valida que sea texto.
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

  // Mayoreo: por producto, opcional, un solo nivel (ver entities/producto.entity.ts).
  // La comparación mayoreoPrecioPorPieza < precio NO se valida aquí porque en un
  // PATCH parcial `precio` puede no venir en el body — VendorProductsService la
  // revalida siempre contra el precio real ya guardado antes de persistir.
  @IsOptional()
  @IsBoolean()
  mayoreoHabilitado?: boolean;

  @ValidateIf((dto: CrearProductoDto) => dto.mayoreoHabilitado === true)
  @Type(() => Number)
  @IsInt()
  @Min(2)
  mayoreoCantidadMinima?: number;

  @ValidateIf((dto: CrearProductoDto) => dto.mayoreoHabilitado === true)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  mayoreoPrecioPorPieza?: number;
}
