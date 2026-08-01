import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MetodoPago } from '../../../entities';

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
}
