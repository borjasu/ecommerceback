import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService, RespuestaProcesarPago } from './payments.service';
import { ProcesarPagoDto } from './dto/procesar-pago.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Controller('pagos')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('procesar')
  @UseGuards(JwtAuthGuard)
  procesar(
    @Body() dto: ProcesarPagoDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<RespuestaProcesarPago> {
    return this.paymentsService.procesar(usuario.id, dto);
  }

  // Sin JwtAuthGuard a propósito: lo llama Mercado Pago, no un usuario con sesión.
  // La autenticidad de la petición se valida con la firma HMAC (x-signature),
  // no con una cookie — por eso es el único endpoint de escritura sin JwtAuthGuard.
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Query('data.id') dataId: string | undefined,
    @Body() body: { data?: { id?: string } },
  ): Promise<void> {
    return this.paymentsService.procesarWebhook({
      xSignature,
      xRequestId,
      dataId: dataId ?? body?.data?.id,
    });
  }
}
