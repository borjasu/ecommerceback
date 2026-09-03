import { join } from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto, ProductoColorImagen } from '../../entities';
import { RecoloreoService } from './recoloreo/recoloreo.service';
import { GenerarColorProductoDto } from './dto/generar-color-producto.dto';
import {
  aProductoColorImagenPlano,
  ProductoColorImagenPlano,
} from './producto-color-imagen.mapper';

const CARPETA_UPLOADS = join(process.cwd(), 'uploads', 'productos-colores');

/**
 * CRUD de las imágenes generadas por color para un producto (ver
 * RecoloreoService para el algoritmo). Separado de VendorProductsService
 * porque no toca la entidad Producto en sí, solo lee su imagenUrl base.
 */
@Injectable()
export class ProductoColorImagenesService {
  constructor(
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
    @InjectRepository(ProductoColorImagen)
    private readonly coloresGenerados: Repository<ProductoColorImagen>,
    private readonly recoloreoService: RecoloreoService,
    private readonly config: ConfigService,
  ) {}

  async generar(
    productoId: string,
    dto: GenerarColorProductoDto,
  ): Promise<ProductoColorImagenPlano> {
    const producto = await this.obtenerProductoOFallar(productoId);
    await this.validarNombreNoDuplicado(productoId, dto.nombreColor);

    let bufferPng: Buffer;
    try {
      bufferPng = await this.recoloreoService.recolorearImagen(
        producto.imagenUrl,
        dto.colorHex,
      );
    } catch (error) {
      // cargarImagenOrigen ya lanza BadRequestException con un mensaje claro
      // (imagen no accesible o formato no soportado); cualquier otro error
      // (sharp, procesamiento de pixeles) se homogeniza al mismo tipo de
      // respuesta sin filtrar detalle interno al vendedor.
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'No se pudo procesar la imagen base del producto.',
      );
    }

    const id = randomUUID();
    await this.guardarArchivo(id, bufferPng);

    const nuevo = this.coloresGenerados.create({
      id,
      productoId,
      nombreColor: dto.nombreColor,
      colorHex: dto.colorHex,
      imagenUrl: this.construirUrlPublica(id),
    });
    const guardado = await this.coloresGenerados.save(nuevo);
    return aProductoColorImagenPlano(guardado);
  }

  async eliminar(productoId: string, colorId: string): Promise<void> {
    const entidad = await this.coloresGenerados.findOne({
      where: { id: colorId, productoId },
    });
    if (!entidad) {
      throw new NotFoundException(
        'Color generado no encontrado para este producto.',
      );
    }

    await this.borrarArchivo(entidad.id);
    await this.coloresGenerados.delete({ id: colorId });
  }

  private async obtenerProductoOFallar(id: string): Promise<Producto> {
    const producto = await this.productos.findOne({ where: { id } });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado.');
    }
    return producto;
  }

  // Duplicados verificados en memoria (case-insensitive) en vez de una
  // consulta SQL con lower(): la cantidad de colores generados por producto
  // es siempre pequeña (un puñado), así que no vale la pena la complejidad
  // extra de un query builder para esto.
  private async validarNombreNoDuplicado(
    productoId: string,
    nombreColor: string,
  ): Promise<void> {
    const existentes = await this.coloresGenerados.find({
      where: { productoId },
    });
    const yaExiste = existentes.some(
      (color) => color.nombreColor.toLowerCase() === nombreColor.toLowerCase(),
    );
    if (yaExiste) {
      throw new ConflictException(
        `Ya existe un color generado con el nombre "${nombreColor}" para este producto.`,
      );
    }
  }

  private async guardarArchivo(id: string, buffer: Buffer): Promise<void> {
    await fs.mkdir(CARPETA_UPLOADS, { recursive: true });
    await fs.writeFile(join(CARPETA_UPLOADS, `${id}.png`), buffer);
  }

  private async borrarArchivo(id: string): Promise<void> {
    try {
      await fs.unlink(join(CARPETA_UPLOADS, `${id}.png`));
    } catch (error) {
      // ENOENT: el archivo ya no estaba (borrado manual, disco reseteado en
      // dev, etc.) — no debe impedir borrar el registro de la BD.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private construirUrlPublica(id: string): string {
    const backendUrl = this.config.get<string>('BACKEND_URL');
    return `${backendUrl}/uploads/productos-colores/${id}.png`;
  }
}
