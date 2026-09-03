import { BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// producto.imagenUrl puede venir en dos formas hoy (no hay backend de subida
// de archivos todavía, ver src/main.ts): una URL externa http(s) (ej. picsum
// en los seeds) o un data URI base64 (subido desde el form del vendedor sin
// pasar por el servidor). Este helper resuelve el buffer de pixeles crudo de
// la imagen base sin importar cuál de los dos sea.
export async function cargarImagenOrigen(
  rutaImagenBase: string,
  http: HttpService,
): Promise<Buffer> {
  if (rutaImagenBase.startsWith('data:')) {
    const separador = rutaImagenBase.indexOf(',');
    if (separador === -1) {
      throw new BadRequestException(
        'La imagen base del producto no es un data URI válido.',
      );
    }
    return Buffer.from(rutaImagenBase.slice(separador + 1), 'base64');
  }

  if (/^https?:\/\//i.test(rutaImagenBase)) {
    try {
      const respuesta = await firstValueFrom(
        http.get<ArrayBuffer>(rutaImagenBase, { responseType: 'arraybuffer' }),
      );
      return Buffer.from(respuesta.data);
    } catch {
      throw new BadRequestException(
        'No se pudo descargar la imagen base del producto.',
      );
    }
  }

  throw new BadRequestException(
    'La imagen base del producto tiene un formato no soportado (se esperaba una URL http(s) o un data URI).',
  );
}
