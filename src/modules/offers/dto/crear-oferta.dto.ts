import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  AplicaA,
  Audiencia,
  Categoria,
  TipoDescuento,
} from '../../../entities';
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

  @ValidateIf((dto: CrearOfertaDto) => dto.aplicaA === AplicaA.CATEGORIA)
  @IsEnum(Categoria)
  categoria?: Categoria;

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
