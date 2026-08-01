import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorito, Producto } from '../../entities';

const CODIGO_VIOLACION_UNIQUE_POSTGRES = '23505';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorito)
    private readonly favoritos: Repository<Favorito>,
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
  ) {}

  listar(usuarioId: string): Promise<Favorito[]> {
    return this.favoritos.find({
      where: { usuarioId },
      relations: { producto: true },
      order: { fecha: 'DESC' },
    });
  }

  async agregar(usuarioId: string, productoId: string): Promise<Favorito> {
    const producto = await this.productos.findOne({
      where: { id: productoId },
    });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado.');
    }

    const existente = await this.favoritos.findOne({
      where: { usuarioId, productoId },
    });
    if (existente) {
      return existente;
    }

    try {
      const nuevo = this.favoritos.create({ usuarioId, productoId });
      return await this.favoritos.save(nuevo);
    } catch (error) {
      // Condición de carrera: dos requests casi simultáneos pasan el "existente"
      // de arriba y ambos intentan insertar. El constraint único de BD (no solo
      // lógica de aplicación) es la última línea de defensa; si truena por eso,
      // simplemente devolvemos el favorito que sí quedó guardado.
      if (this.esViolacionDeUnicidad(error)) {
        const favorito = await this.favoritos.findOne({
          where: { usuarioId, productoId },
        });
        if (favorito) {
          return favorito;
        }
      }
      throw error;
    }
  }

  async quitar(usuarioId: string, productoId: string): Promise<void> {
    await this.favoritos.delete({ usuarioId, productoId });
  }

  private esViolacionDeUnicidad(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === CODIGO_VIOLACION_UNIQUE_POSTGRES
    );
  }
}
