import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { Favorito } from '../../entities';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Controller('favoritos')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  listar(@CurrentUser() usuario: AuthenticatedUser): Promise<Favorito[]> {
    return this.favoritesService.listar(usuario.id);
  }

  @Post(':productoId')
  agregar(
    @Param('productoId', ParseUUIDPipe) productoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<Favorito> {
    return this.favoritesService.agregar(usuario.id, productoId);
  }

  @Delete(':productoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  quitar(
    @Param('productoId', ParseUUIDPipe) productoId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<void> {
    return this.favoritesService.quitar(usuario.id, productoId);
  }
}
