import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AplicaA, Audiencia, TipoDescuento } from '../../../entities';
import { ValorOfertaValido } from '../validators/valor-oferta-valido.validator';

export class CrearOfertaDto {
  @MinLength(2)
  nombre: string;

  @IsEnum(TipoDescuento)
  tipoDescuento: TipoDescuento;

  @Type(() => Number)
  @IsNumber()
  @ValorOfertaValido()
  valor: number;

  @IsEnum(AplicaA)
  aplicaA: AplicaA;

  @ValidateIf((dto: CrearOfertaDto) => dto.aplicaA === AplicaA.PRODUCTO)
  @IsUUID()
  productoId?: string;

  // Categoria ya no es un enum fijo (ver modules/catalogos) — se valida solo
  // la forma; un nombre que no exista o se borre después simplemente deja de
  // coincidir con algún producto (ver Oferta.categoria).
  @ValidateIf((dto: CrearOfertaDto) => dto.aplicaA === AplicaA.CATEGORIA)
  @IsString()
  @MaxLength(60)
  categoria?: string;

  @ValidateIf((dto: CrearOfertaDto) => dto.aplicaA === AplicaA.AUDIENCIA)
  @IsEnum(Audiencia)
  audiencia?: Audiencia;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
