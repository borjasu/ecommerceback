import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ShippingService, RespuestaCotizacion } from './shipping.service';
import { CotizarEnvioDto } from './dto/cotizar-envio.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Controller('envios')
@UseGuards(JwtAuthGuard)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('cotizar')
  // Límite propio, más estricto que el throttling global: cada cotización dispara
  // una llamada real (y probablemente facturable) a Skydropx.
  @Throttle({ shipping: { limit: 10, ttl: 60000 } })
  cotizar(
    @Body() dto: CotizarEnvioDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<RespuestaCotizacion> {
    return this.shippingService.cotizar(usuario.id, dto);
  }
}
