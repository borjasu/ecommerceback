import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

// Sin ningún campo de monto: el total a cobrar SIEMPRE se lee del Pedido ya
// guardado en BD (pedido.total, calculado en OrdersService), nunca de este body.
export class ProcesarPagoDto {
  @IsUUID()
  pedidoId: string;

  // Token de tarjeta generado en el frontend con Mercado Pago.js / Checkout Bricks.
  // El backend nunca ve número de tarjeta, CVV ni fecha de expiración.
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  installments?: number;
}
