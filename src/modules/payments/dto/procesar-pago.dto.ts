import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// Documento de identidad del pagador — Mercado Pago lo exige para varios
// métodos en México (p. ej. tickets OXXO), el Payment Brick ya lo recolecta
// y lo manda dentro de `payer.identification`.
class IdentificacionPagadorDto {
  @IsString()
  type: string;

  @IsString()
  number: string;
}

class PagadorFormDataDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => IdentificacionPagadorDto)
  identification?: IdentificacionPagadorDto;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;
}

/**
 * Espeja el `formData` que entrega el callback `onSubmit` del Payment Brick
 * (https://www.mercadopago.com.mx/developers — Checkout Bricks) tal cual se
 * manda a `payment.create({ body: formData })`, más `pedidoId` (que el Brick
 * no incluye, lo agrega el frontend por su cuenta). El shape exacto de
 * `formData` varía según el método que el comprador eligió DENTRO del Brick:
 * tarjeta trae `token`/`installments`/`issuer_id`, ticket (OXXO) y transferencia
 * no traen `token`. Todos los campos salvo `pedidoId`/`payment_method_id`/
 * `payer.email`/`transaction_amount` son opcionales por eso.
 */
export class ProcesarPagoDto {
  @IsUUID()
  pedidoId: string;

  // Se valida contra pedido.total ANTES de llamar a Mercado Pago — si no
  // coincide (manipulación del lado cliente), se rechaza aquí mismo, sin
  // siquiera intentar cobrar (ver PaymentsService.procesar).
  @IsNumber()
  @Min(0.01)
  transaction_amount: number;

  @IsString()
  payment_method_id: string;

  // Solo viene en el formData cuando el comprador elige tarjeta.
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  installments?: number;

  // El Brick lo manda como string; se castea a number al armar el payload
  // real hacia el SDK de Mercado Pago (su tipo lo espera numérico).
  @IsOptional()
  @IsString()
  issuer_id?: string;

  @ValidateNested()
  @Type(() => PagadorFormDataDto)
  payer: PagadorFormDataDto;
}
