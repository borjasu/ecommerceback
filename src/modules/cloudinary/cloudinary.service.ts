import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface ImagenSubida {
  url: string;
  publicId: string;
}

// Prefijo común de todo lo que sube esta app — separa el proyecto de
// cualquier otra cosa que eventualmente viva en la misma cuenta de Cloudinary.
const CARPETA_RAIZ = 'frank-jeans';

/**
 * Almacenamiento real de imágenes de producto — reemplaza el fs.writeFile a
 * disco local que usaba ProductoColorImagenesService (y el base64-en-columna
 * que usaba VendorProductsService para la imagen general): el filesystem de
 * Railway es efímero por deploy, así que nada que dependa de disco local
 * sobrevive un redeploy en producción.
 */
@Injectable()
export class CloudinaryService {
  constructor(config: ConfigService) {
    cloudinary.config({
      cloud_name: config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: config.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  /** Fotos por color (vienen como Buffer en memoria, ver FileInterceptor con memoryStorage). */
  subirBuffer(buffer: Buffer, carpeta: string): Promise<ImagenSubida> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `${CARPETA_RAIZ}/${carpeta}` },
        (error, resultado) => {
          if (error || !resultado) {
            reject(
              error instanceof Error
                ? error
                : new Error('Cloudinary no devolvió resultado al subir la imagen.'),
            );
            return;
          }
          resolve({ url: resultado.secure_url, publicId: resultado.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  /**
   * Imagen general de producto: el DTO la sigue recibiendo como data URI
   * base64 dentro del JSON (mismo contrato que ya tenía el frontend, ver
   * VendorProductsService) — Cloudinary acepta un data URI directo, sin
   * necesidad de decodificarlo a Buffer a mano primero.
   */
  async subirDataUri(dataUri: string, carpeta: string): Promise<ImagenSubida> {
    const resultado = await cloudinary.uploader.upload(dataUri, {
      folder: `${CARPETA_RAIZ}/${carpeta}`,
    });
    return { url: resultado.secure_url, publicId: resultado.public_id };
  }

  async eliminar(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  /** Distingue "hay que subir esto" de "ya es una URL" (placeholder picsum, o una ya subida antes). */
  esDataUriDeImagen(valor: string): boolean {
    return valor.startsWith('data:image/');
  }
}
