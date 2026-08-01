import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { VendorOrdersService } from './vendor-orders.service';
import { CambiarEstadoPedidoDto } from './dto/cambiar-estado-pedido.dto';
import { CambiarEstadoPagoDto } from './dto/cambiar-estado-pago.dto';
import { RegistrarEnvioDto } from './dto/registrar-envio.dto';
import { Pedido, RolUsuario } from '../../entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// Prefijo /vendedor/pedidos (no /pedidos) a propósito: evita chocar con
// GET /pedidos y GET /pedidos/:id del OrdersController del comprador (mismo
// verbo, mismo path, pero semántica de acceso totalmente distinta — uno
// filtra por dueño, este ve todo).
@Controller('vendedor/pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.VENDEDOR)
export class VendorOrdersController {
  constructor(private readonly vendorOrdersService: VendorOrdersService) {}

  @Get()
  listar(): Promise<Pedido[]> {
    return this.vendorOrdersService.listarTodos();
  }

  @Get(':id')
  obtenerUno(@Param('id', ParseUUIDPipe) id: string): Promise<Pedido> {
    return this.vendorOrdersService.obtenerUno(id);
  }

  @Patch(':id/estado')
  actualizarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoPedidoDto,
  ): Promise<Pedido> {
    return this.vendorOrdersService.actualizarEstado(id, dto);
  }

  @Patch(':id/estado-pago')
  actualizarEstadoPago(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambiarEstadoPagoDto,
  ): Promise<Pedido> {
    return this.vendorOrdersService.actualizarEstadoPago(id, dto);
  }

  @Patch(':id/envio')
  registrarEnvioManual(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarEnvioDto,
  ): Promise<Pedido> {
    return this.vendorOrdersService.registrarEnvioManual(id, dto);
  }

  // Alternativa automática a PATCH :id/envio: cotiza en vivo con Skydropx,
  // elige la tarifa más cercana a lo que el cliente ya pagó, y genera la guía
  // real (número de rastreo + PDF de etiqueta) sin captura manual.
  @Post(':id/generar-guia')
  generarGuiaAutomatica(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Pedido> {
    return this.vendorOrdersService.generarGuiaAutomatica(id);
  }
}
