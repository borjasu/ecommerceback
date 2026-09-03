import sharp from 'sharp';
import type { HttpService } from '@nestjs/axios';
import { RecoloreoService } from './recoloreo.service';

const ANCHO = 40;
const ALTO = 40;

/**
 * PNG sintético 40×40: fondo blanco liso + un cuadrado "prenda" gris de
 * 20×20 al centro, con dos tonos (mitad superior más clara que la inferior,
 * simulando una sombra) para poder comprobar que la Lightness original se
 * conserva al recolorear.
 */
async function crearImagenDePrueba(): Promise<string> {
  const canal = Buffer.alloc(ANCHO * ALTO * 3, 255); // arranca todo blanco

  for (let y = 10; y < 30; y += 1) {
    for (let x = 10; x < 30; x += 1) {
      const base = (y * ANCHO + x) * 3;
      const tono = y >= 20 ? 80 : 150; // mitad inferior = sombra
      canal[base] = tono;
      canal[base + 1] = tono;
      canal[base + 2] = tono;
    }
  }

  const png = await sharp(canal, { raw: { width: ANCHO, height: ALTO, channels: 3 } })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

describe('RecoloreoService', () => {
  let service: RecoloreoService;

  beforeEach(() => {
    // El servicio solo usa HttpService para imágenes http(s); estos tests
    // usan data URIs, así que un stub vacío basta (nunca se invoca).
    service = new RecoloreoService({} as HttpService);
  });

  it('conserva el fondo intacto y recolorea la prenda preservando la sombra', async () => {
    const imagenBase = await crearImagenDePrueba();
    const resultado = await service.recolorearImagen(imagenBase, '#ff0000');

    const { data, info } = await sharp(resultado)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(ANCHO);
    expect(info.height).toBe(ALTO);

    const leerPixel = (x: number, y: number) => {
      const base = (y * info.width + x) * info.channels;
      return { r: data[base], g: data[base + 1], b: data[base + 2] };
    };

    // Esquina: fondo, prácticamente sin cambio.
    const esquina = leerPixel(0, 0);
    expect(esquina.r).toBeGreaterThan(245);
    expect(esquina.g).toBeGreaterThan(245);
    expect(esquina.b).toBeGreaterThan(245);

    // Zona clara de la prenda (y=15): debe virar a rojo dominante.
    const claro = leerPixel(15, 15);
    expect(claro.r).toBeGreaterThan(claro.g);
    expect(claro.r).toBeGreaterThan(claro.b);

    // Zona con sombra (y=25): también vira a rojo, pero se mantiene más
    // oscura que la zona clara — la sombra original se conserva.
    const sombra = leerPixel(15, 25);
    expect(sombra.r).toBeGreaterThan(sombra.g);
    expect(sombra.r).toBeLessThan(claro.r);
  });
});
