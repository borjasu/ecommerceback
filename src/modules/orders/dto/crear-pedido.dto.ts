import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MetodoPago } from '../../../entities';

// Factura fiscal: OPCIONAL — solo se manda este objeto si el comprador marcó
// "Requiero factura fiscal" en el checkout. Si no viene, el pedido
// simplemente no lleva datos fiscales (columnas NULL), nunca se exige.
export class DatosFiscalesDto {
  @IsString()
  @MinLength(12)
  @MaxLength(13)
  rfc: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  razonSocial: string;

  @IsString()
  @MaxLength(10)
  regimenFiscal: string;
}

// Nota deliberada: este DTO NO tiene ningún campo de precio ni de costo de envío.
// Es la primera línea de defensa contra manipulación de precios (OWASP A03/A08):
// si el campo no existe en el DTO y el ValidationPipe global usa
// { whitelist: true, forbidNonWhitelisted: true }, un intento de mandar
// "precioUnitario" o "costoEnvio" en el body directamente hace que la petición
// entera sea rechazada con 400, antes de que el servicio siquiera se ejecute.
export class ItemPedidoDto {
  @IsUUID()
  productoId: string;

  // Talla/color ya no son enums fijos (ver modules/catalogos) — OrdersService
  // valida que el nombre exista, esté activo y pertenezca al catálogo de ESE
  // producto (ver `producto.tallasDisponibles`/`coloresDisponibles`).
  @IsString()
  @MaxLength(20)
  talla: string;

  @IsString()
  @MaxLength(60)
  color: string;

  @IsInt()
  @Min(1)
  cantidad: number;
}

export class CrearPedidoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  items: ItemPedidoDto[];

  @IsUUID()
  direccionId: string;

  // Identificadores devueltos por POST /envios/cotizar — el backend vuelve a
  // consultar/revalidar con estos, nunca usa un costoEnvio que venga suelto en el body.
  @IsString()
  cotizacionId: string;

  @IsString()
  rateId: string;

  @IsEnum(MetodoPago)
  metodoPago: MetodoPago;

  @IsOptional()
  @ValidateNested()
  @Type(() => DatosFiscalesDto)
  datosFiscales?: DatosFiscalesDto;
}
