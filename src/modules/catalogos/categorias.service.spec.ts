import type { Repository } from 'typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Categoria, Producto } from '../../entities';
import { CategoriasService } from './categorias.service';

function crearCategoria(overrides: Partial<Categoria> = {}): Categoria {
  return { id: 'cat-1', nombre: 'pantalon', icono: 'pantalon', orden: 1, ...overrides };
}

describe('CategoriasService', () => {
  let service: CategoriasService;
  let categorias: jest.Mocked<Pick<Repository<Categoria>, 'find' | 'save' | 'create' | 'findOne' | 'delete'>>;
  let productos: jest.Mocked<Pick<Repository<Producto>, 'count'>>;

  beforeEach(() => {
    categorias = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((dto) => dto as Categoria),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    productos = { count: jest.fn() };

    service = new CategoriasService(
      categorias as unknown as Repository<Categoria>,
      productos as unknown as Repository<Producto>,
    );
  });

  describe('eliminar', () => {
    it('rechaza el borrado con un mensaje claro si hay productos usando la categoría (punto 4 de verificación)', async () => {
      categorias.findOne.mockResolvedValue(crearCategoria());
      productos.count.mockResolvedValue(3);

      await expect(service.eliminar('cat-1')).rejects.toThrow(BadRequestException);
      await expect(service.eliminar('cat-1')).rejects.toThrow(/3 producto\(s\) la usan/);
      expect(categorias.delete).not.toHaveBeenCalled();
    });

    it('elimina la categoría cuando ningún producto la usa (punto 5 de verificación)', async () => {
      categorias.findOne.mockResolvedValue(crearCategoria());
      productos.count.mockResolvedValue(0);

      await service.eliminar('cat-1');

      expect(categorias.delete).toHaveBeenCalledWith({ id: 'cat-1' });
    });

    it('lanza 404 si la categoría no existe', async () => {
      categorias.findOne.mockResolvedValueOnce(null);

      await expect(service.eliminar('inexistente')).rejects.toThrow(NotFoundException);
      expect(productos.count).not.toHaveBeenCalled();
    });

    it('convierte una violación de FK (condición de carrera) en un mensaje claro en vez de dejarla burbujear', async () => {
      categorias.findOne.mockResolvedValue(crearCategoria());
      productos.count.mockResolvedValue(0);
      categorias.delete.mockRejectedValueOnce({ code: '23503' });

      await expect(service.eliminar('cat-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('crear', () => {
    it('convierte una violación de nombre único de Postgres (23505) en 409 (punto 6 de verificación)', async () => {
      categorias.save.mockRejectedValueOnce({ code: '23505' });

      await expect(
        service.crear({ nombre: 'pantalon', icono: 'pantalon', orden: 1 }),
      ).rejects.toThrow(ConflictException);
    });

    it('guarda la categoría cuando el nombre no está repetido', async () => {
      const guardada = crearCategoria({ nombre: 'sudadera', icono: 'sudadera', orden: 5 });
      categorias.save.mockResolvedValueOnce(guardada);

      const resultado = await service.crear({ nombre: 'sudadera', icono: 'sudadera', orden: 5 });

      expect(resultado).toEqual(guardada);
    });
  });

  describe('existeOFallar', () => {
    it('rechaza un nombre que no existe en el catálogo vigente', async () => {
      (categorias as unknown as { exists: jest.Mock }).exists = jest.fn().mockResolvedValueOnce(false);

      await expect(service.existeOFallar('inventada')).rejects.toThrow(BadRequestException);
    });

    it('resuelve sin error cuando el nombre sí existe', async () => {
      (categorias as unknown as { exists: jest.Mock }).exists = jest.fn().mockResolvedValueOnce(true);

      await expect(service.existeOFallar('pantalon')).resolves.toBeUndefined();
    });
  });
});
