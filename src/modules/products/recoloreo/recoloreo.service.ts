import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import sharp from 'sharp';
import { cargarImagenOrigen } from './imagen-origen.util';
import { hexToRgb, hslToRgb, rgbToHsl } from './color-hsl.util';

// Tamaño del bloque muestreado en cada esquina para estimar el color de
// fondo — un bloque en vez de un solo pixel evita que un artefacto de
// compresión JPEG puntual en la esquina desvíe la detección.
const TAMANO_MUESTRA_ESQUINA = 5;

// Distancia euclidiana (al cuadrado, para no pagar sqrt por pixel) por
// debajo de la cual un pixel se considera "igual al fondo". 40/255 es
// bastante permisivo con fondos blancos/gris claro ligeramente desiguales
// (viñeteo, JPEG) sin llegar a morder colores claros de la prenda misma.
const TOLERANCIA_FONDO = 40;
const TOLERANCIA_FONDO_AL_CUADRADO = TOLERANCIA_FONDO * TOLERANCIA_FONDO;

// Alpha por debajo de este valor se trata como "ya era transparente en el
// original" — cuenta como fondo sin importar su color RGB.
const UMBRAL_ALPHA_TRANSPARENTE = 128;

// Sigma del blur aplicado a la MÁSCARA (no a los colores) para suavizar el
// contorno prenda/fondo — ver el paso 4 del algoritmo.
const SIGMA_BLUR_BORDE = 1.5;

/**
 * Recoloreo algorítmico de prendas sobre fondo blanco/liso — sin ninguna API
 * de IA generativa. El pipeline completo:
 *   1. Detectar el color de fondo muestreando las 4 esquinas.
 *   2. Construir una máscara binaria prenda/fondo por umbral de color + alpha.
 *   3. Suavizar el BORDE de esa máscara con un blur pequeño (no los colores),
 *      para que la mezcla final no tenga un contorno duro/pixelado.
 *   4. Para cada pixel de la prenda: tomar su Lightness (HSL) original y
 *      combinarlo con el Hue/Saturation del color destino — así se preservan
 *      sombras, pliegues y brillos de la tela en vez de un relleno plano.
 *   5. Mezclar el resultado recoloreado con el original usando la máscara
 *      suavizada como factor alpha, y devolver un PNG nuevo.
 */
@Injectable()
export class RecoloreoService {
  constructor(private readonly http: HttpService) {}

  async recolorearImagen(
    rutaImagenBase: string,
    colorHex: string,
  ): Promise<Buffer> {
    const bufferOrigen = await cargarImagenOrigen(rutaImagenBase, this.http);

    // toColourspace('srgb') antes de ensureAlpha(): garantiza 3 canales de
    // color (evita el caso raro de una imagen base en escala de grises, que
    // solo tiene 1) para que ensureAlpha() termine siempre en RGBA (4 canales).
    const { data, info } = await sharp(bufferOrigen)
      .toColourspace('srgb')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    const pixeles = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);

    const colorFondo = this.detectarColorFondo(pixeles, width, height);
    const mascara = this.construirMascara(pixeles, width, height, colorFondo);
    const mascaraSuave = await this.suavizarMascara(mascara, width, height);

    const [rDestino, gDestino, bDestino] = hexToRgb(colorHex);
    const [hDestino, sDestino] = rgbToHsl(rDestino, gDestino, bDestino);

    const salida = Buffer.from(pixeles); // arranca como copia del original; solo se sobreescriben los pixeles de la prenda
    for (let i = 0; i < width * height; i += 1) {
      const factor = mascaraSuave[i] / 255;
      if (factor === 0) {
        continue; // fondo puro: no se toca
      }

      const base = i * 4;
      const r = pixeles[base];
      const g = pixeles[base + 1];
      const b = pixeles[base + 2];

      const [, , lOriginal] = rgbToHsl(r, g, b);
      const [rNuevo, gNuevo, bNuevo] = hslToRgb(hDestino, sDestino, lOriginal);

      salida[base] = Math.round(factor * rNuevo + (1 - factor) * r);
      salida[base + 1] = Math.round(factor * gNuevo + (1 - factor) * g);
      salida[base + 2] = Math.round(factor * bNuevo + (1 - factor) * b);
      // canal alpha (base + 3) se conserva igual al original: el fondo
      // transparente, si lo había, sigue transparente.
    }

    return sharp(salida, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer();
  }

  /** Promedia bloques de TAMANO_MUESTRA_ESQUINA×TAMANO_MUESTRA_ESQUINA en las 4 esquinas. */
  private detectarColorFondo(
    pixeles: Uint8ClampedArray,
    width: number,
    height: number,
  ): [number, number, number] {
    const anchoMuestra = Math.min(TAMANO_MUESTRA_ESQUINA, width);
    const altoMuestra = Math.min(TAMANO_MUESTRA_ESQUINA, height);
    const esquinas: Array<[number, number]> = [
      [0, 0],
      [width - anchoMuestra, 0],
      [0, height - altoMuestra],
      [width - anchoMuestra, height - altoMuestra],
    ];

    let sumaR = 0;
    let sumaG = 0;
    let sumaB = 0;
    let total = 0;

    for (const [xInicio, yInicio] of esquinas) {
      for (let y = yInicio; y < yInicio + altoMuestra; y += 1) {
        for (let x = xInicio; x < xInicio + anchoMuestra; x += 1) {
          const base = (y * width + x) * 4;
          sumaR += pixeles[base];
          sumaG += pixeles[base + 1];
          sumaB += pixeles[base + 2];
          total += 1;
        }
      }
    }

    return [sumaR / total, sumaG / total, sumaB / total];
  }

  private construirMascara(
    pixeles: Uint8ClampedArray,
    width: number,
    height: number,
    colorFondo: [number, number, number],
  ): Uint8Array {
    const [rFondo, gFondo, bFondo] = colorFondo;
    const mascara = new Uint8Array(width * height);

    for (let i = 0; i < width * height; i += 1) {
      const base = i * 4;
      const r = pixeles[base];
      const g = pixeles[base + 1];
      const b = pixeles[base + 2];
      const alpha = pixeles[base + 3];

      const dR = r - rFondo;
      const dG = g - gFondo;
      const dB = b - bFondo;
      const distanciaCuadrada = dR * dR + dG * dG + dB * dB;

      const esFondo =
        alpha < UMBRAL_ALPHA_TRANSPARENTE ||
        distanciaCuadrada < TOLERANCIA_FONDO_AL_CUADRADO;
      mascara[i] = esFondo ? 0 : 255;
    }

    return mascara;
  }

  /**
   * Bluerea la máscara (no los colores de la prenda) para que la franja de
   * transición prenda/fondo quede con un degradado suave 0-255 en vez de un
   * corte binario — así el paso de mezcla final no deja un contorno duro.
   */
  private async suavizarMascara(
    mascara: Uint8Array,
    width: number,
    height: number,
  ): Promise<Uint8Array> {
    // toColourspace('b-w') después de blur(): sharp sube internamente un raw
    // de 1 canal a 3 al aplicar blur (verificado en pruebas — el buffer de
    // salida sale con el triple del tamaño esperado si no se fuerza esto),
    // así que hay que forzarlo de vuelta a escala de grises de 1 canal antes
    // de extraer el buffer crudo, o los índices de la máscara quedan
    // desalineados con width*height.
    const suavizada = await sharp(Buffer.from(mascara), {
      raw: { width, height, channels: 1 },
    })
      .blur(SIGMA_BLUR_BORDE)
      .toColourspace('b-w')
      .raw()
      .toBuffer();
    return new Uint8Array(suavizada.buffer, suavizada.byteOffset, suavizada.length);
  }
}
