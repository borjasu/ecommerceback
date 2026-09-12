import { Controller, Get, Param } from '@nestjs/common';
import {
  CodigoPostalRespuesta,
  PostalCodesService,
} from './postal-codes.service';

// Sin @UseGuards ni @CurrentUser a propósito: catálogo público de solo
// lectura (igual que /productos), no expone datos de ningún usuario — el
// límite "default" del ThrottlerModule (ver app.module.ts) ya aplica aquí
// sin necesidad de un @Throttle propio.
@Controller('codigos-postales')
export class PostalCodesController {
  constructor(private readonly postalCodesService: PostalCodesService) {}

  @Get(':cp')
  buscarPorCp(@Param('cp') cp: string): Promise<CodigoPostalRespuesta> {
    return this.postalCodesService.buscarPorCp(cp);
  }
}
