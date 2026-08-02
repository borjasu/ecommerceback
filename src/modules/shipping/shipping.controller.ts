import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ShippingService, RespuestaCotizacion } from './shipping.service';
import { CotizarEnvioDto } from './dto/cotizar-envio.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Controller('envios')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('cotizar')
  @UseGuards(JwtAuthGuard)
  // Sobreescribe el throttler "default" SOLO para esta ruta (ver nota en
  // app.module.ts sobre por qué no se registra un throttler nombrado nuevo):
  // cada cotización dispara una llamada real (y probablemente facturable) a
  // Skydropx, límite más estricto que el global.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  cotizar(
    @Body() dto: CotizarEnvioDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<RespuestaCotizacion> {
    return this.shippingService.cotizar(usuario.id, dto);
  }

  // Sin JwtAuthGuard a propósito, igual que PaymentsController.webhook: lo
  // llama Skydropx, no un usuario con sesión. Ver ShippingService.procesarWebhookRastreo
  // para el estado (no confirmado oficialmente) de la firma de este webhook.
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Headers('x-skydropx-signature') firma: string | undefined,
    @Body()
    body: {
      data?: { id?: string; tracking_number?: string; status?: string };
    },
  ): Promise<void> {
    return this.shippingService.procesarWebhookRastreo(body, firma);
  }
}
