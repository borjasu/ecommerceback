import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto, ProductoColorImagen } from '../../entities';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { SubirFotoColorDto } from './dto/subir-foto-color.dto';
import {
  aProductoColorImagenPlano,
  ProductoColorImagenPlano,
} from './producto-color-imagen.mapper';

const CARPETA_CLOUDINARY = 'productos-colores';

// Whitelist explícita de mimetypes (no se confía en file.originalname del
// cliente): mismo criterio que exigir `image/*` en el <input type="file">
// del frontend, pero validado también aquí porque ese accept es solo una
// sugerencia del navegador, no una garantía de lo que realmente llega en el
// request.
const MIMETYPES_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

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
    private readonly cloudinary: CloudinaryService,
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
    if (!MIMETYPES_PERMITIDOS.has(archivo.mimetype)) {
      throw new BadRequestException(
        'Formato de imagen no soportado. Usa JPG, PNG o WEBP.',
      );
    }

    const { url, publicId } = await this.cloudinary.subirBuffer(
      archivo.buffer,
      CARPETA_CLOUDINARY,
    );

    const nuevo = this.imagenesColores.create({
      // A diferencia del resto de las tablas del proyecto, esta columna id
      // NO tiene DEFAULT gen_random_uuid() a nivel de base de datos (ver
      // ProductoColorImagenes1785583762405) — siempre se generó del lado de
      // la aplicación. Quitarlo aquí (como se hizo al migrar a Cloudinary)
      // hace que TypeORM mande DEFAULT en el INSERT y Postgres lo rechace
      // por NOT NULL.
      id: randomUUID(),
      productoId,
      nombreColor: dto.nombreColor,
      colorHex: dto.colorHex,
      imagenUrl: url,
      imagenPublicId: publicId,
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

    // Filas creadas antes de la migración a Cloudinary no tienen publicId
    // (venían de fs.writeFile) — no hay nada que borrar del storage en ese
    // caso, solo la fila.
    if (entidad.imagenPublicId) {
      await this.cloudinary.eliminar(entidad.imagenPublicId);
    }
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
}
