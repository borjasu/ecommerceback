import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CrearPedidoDto } from './dto/crear-pedido.dto';
import { Pedido } from '../../entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

// Nota para el módulo vendedor: aquí NO viven PATCH /pedidos/:id/estado,
// PATCH /pedidos/:id/envio ni PATCH /pedidos/:id/estado-pago. Esos son de
// @Roles('vendedor') sobre esta misma entidad Pedido — se agregan en un
// controlador separado del lado admin, sin tocar este archivo.
@Controller('pedidos')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  crear(
    @Body() dto: CrearPedidoDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<Pedido> {
    return this.ordersService.crear(usuario.id, dto);
  }

  @Get()
  listar(@CurrentUser() usuario: AuthenticatedUser): Promise<Pedido[]> {
    return this.ordersService.listarDelUsuario(usuario.id);
  }

  @Get(':id')
  obtenerUno(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<Pedido> {
    return this.ordersService.obtenerUnoDelUsuario(id, usuario.id);
  }
}
