import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { CrearMensajeContactoDto } from './dto/crear-mensaje-contacto.dto';
import { MensajeContacto, RolUsuario } from '../../entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

// Límite propio y estricto (aparte del global) — es un endpoint público SIN
// autenticación, el más expuesto a spam/abuso de todo el backend: 3 mensajes
// cada 10 minutos por IP.
const THROTTLE_CONTACTO = {
  contacto: { limit: 3, ttl: 600_000 },
};

@Controller('contacto')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Throttle(THROTTLE_CONTACTO)
  @HttpCode(HttpStatus.CREATED)
  crear(@Body() dto: CrearMensajeContactoDto): Promise<void> {
    return this.contactService.crear(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.VENDEDOR)
  listar(): Promise<MensajeContacto[]> {
    return this.contactService.listar();
  }
}
