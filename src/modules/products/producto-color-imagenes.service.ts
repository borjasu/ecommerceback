import { join, extname } from 'path';
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
import { SubirFotoColorDto } from './dto/subir-foto-color.dto';
import {
  aProductoColorImagenPlano,
  ProductoColorImagenPlano,
} from './producto-color-imagen.mapper';

const CARPETA_UPLOADS = join(process.cwd(), 'uploads', 'productos-colores');

// mimetype → extensión de archivo. Whitelist explícita (no se confía en
// file.originalname del cliente para la extensión): mismo criterio que
// exigir `image/*` en el <input type="file"> del frontend, pero validado
// también aquí porque ese accept es solo una sugerencia del navegador, no
// una garantía de lo que realmente llega en el request.
const EXTENSIONES_PERMITIDAS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * CRUD de las fotos por color de un producto: una foto real por color
 * habilitado, subida a mano por el vendedor (reemplaza al recoloreo
 * algorítmico — ver el docstring de la entidad ProductoColorImagen para el
 * porqué). Separado de VendorProductsService porque no toca la entidad
 * Producto en sí.
 */
@Injectable()
export class ProductoColorImagenesService {
  constructor(
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
    @InjectRepository(ProductoColorImagen)
    private readonly imagenesColores: Repository<ProductoColorImagen>,
    private readonly config: ConfigService,
  ) {}

  async subirFoto(
    productoId: string,
    dto: SubirFotoColorDto,
    archivo: Express.Multer.File | undefined,
  ): Promise<ProductoColorImagenPlano> {
    await this.obtenerProductoOFallar(productoId);
    await this.validarNombreNoDuplicado(productoId, dto.nombreColor);

    if (!archivo) {
      throw new BadRequestException('Falta la foto del color.');
    }
    const extension = EXTENSIONES_PERMITIDAS[archivo.mimetype];
    if (!extension) {
      throw new BadRequestException(
        'Formato de imagen no soportado. Usa JPG, PNG o WEBP.',
      );
    }

    const id = randomUUID();
    await this.guardarArchivo(id, extension, archivo.buffer);

    const nuevo = this.imagenesColores.create({
      id,
      productoId,
      nombreColor: dto.nombreColor,
      colorHex: dto.colorHex,
      imagenUrl: this.construirUrlPublica(id, extension),
    });
    const guardado = await this.imagenesColores.save(nuevo);
    return aProductoColorImagenPlano(guardado);
  }

  async eliminar(productoId: string, colorId: string): Promise<void> {
    const entidad = await this.imagenesColores.findOne({
      where: { id: colorId, productoId },
    });
    if (!entidad) {
      throw new NotFoundException(
        'Foto de color no encontrada para este producto.',
      );
    }

    await this.borrarArchivo(entidad);
    await this.imagenesColores.delete({ id: colorId });
  }

  private async obtenerProductoOFallar(id: string): Promise<Producto> {
    const producto = await this.productos.findOne({ where: { id } });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado.');
    }
    return producto;
  }

  // Duplicados verificados en memoria (case-insensitive) en vez de una
  // consulta SQL con lower(): la cantidad de fotos por producto es siempre
  // pequeña (un puñado de colores), así que no vale la pena la complejidad
  // extra de un query builder para esto.
  private async validarNombreNoDuplicado(
    productoId: string,
    nombreColor: string,
  ): Promise<void> {
    const existentes = await this.imagenesColores.find({
      where: { productoId },
    });
    const yaExiste = existentes.some(
      (color) => color.nombreColor.toLowerCase() === nombreColor.toLowerCase(),
    );
    if (yaExiste) {
      throw new ConflictException(
        `Ya existe una foto con el nombre "${nombreColor}" para este producto.`,
      );
    }
  }

  private async guardarArchivo(
    id: string,
    extension: string,
    buffer: Buffer,
  ): Promise<void> {
    await fs.mkdir(CARPETA_UPLOADS, { recursive: true });
    await fs.writeFile(join(CARPETA_UPLOADS, `${id}${extension}`), buffer);
  }

  private async borrarArchivo(entidad: ProductoColorImagen): Promise<void> {
    // La extensión real se saca de la propia imagenUrl guardada (puede ser
    // .jpg/.png/.webp según lo que se subió) en vez de asumir una fija.
    const nombreArchivo = `${entidad.id}${extname(entidad.imagenUrl)}`;
    try {
      await fs.unlink(join(CARPETA_UPLOADS, nombreArchivo));
    } catch (error) {
      // ENOENT: el archivo ya no estaba (borrado manual, disco reseteado en
      // dev, etc.) — no debe impedir borrar el registro de la BD.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private construirUrlPublica(id: string, extension: string): string {
    const backendUrl = this.config.get<string>('BACKEND_URL');
    return `${backendUrl}/uploads/productos-colores/${id}${extension}`;
  }
}
