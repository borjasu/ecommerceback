import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CodigoPostal } from '../../entities';

export interface ColoniaRespuesta {
  nombre: string;
  tipoAsentamiento: string | null;
}

export interface CodigoPostalRespuesta {
  estado: string;
  municipio: string;
  colonias: ColoniaRespuesta[];
}

@Injectable()
export class PostalCodesService {
  constructor(
    @InjectRepository(CodigoPostal)
    private readonly codigosPostales: Repository<CodigoPostal>,
  ) {}

  // Un mismo CP trae varias filas (una por colonia) — todas comparten
  // estado/municipio, así que basta con leerlos de la primera. Si el CP no
  // existe en el catálogo (hueco de cobertura real, o un CP inventado), esto
  // regresa un arreglo vacío y se traduce a 404 aquí mismo.
  async buscarPorCp(cp: string): Promise<CodigoPostalRespuesta> {
    const filas = await this.codigosPostales.find({
      where: { codigoPostal: cp },
      order: { colonia: 'ASC' },
    });

    if (filas.length === 0) {
      throw new NotFoundException(
        `No encontramos el código postal ${cp} en el catálogo.`,
      );
    }

    return {
      estado: filas[0].estado,
      municipio: filas[0].municipio,
      colonias: filas.map((fila) => ({
        nombre: fila.colonia,
        tipoAsentamiento: fila.tipoAsentamiento,
      })),
    };
  }
}
