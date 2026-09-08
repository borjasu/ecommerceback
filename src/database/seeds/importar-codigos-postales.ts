import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppDataSource } from '../data-source';
import { CodigoPostal } from '../../entities';

/**
 * Importa el Catálogo Nacional de Códigos Postales a la tabla
 * `codigos_postales` (ver entities/codigo-postal.entity.ts).
 *
 * FUENTE: SEPOMEX publica el catálogo oficial de forma gratuita en
 * https://www.correosdemexico.gob.mx/SSLServicios/ConsultaCP/Descarga.aspx
 * ("se proporciona en forma gratuita, no estando permitida su
 * comercialización, total o parcial" — uso interno de consulta, no reventa
 * del catálogo). El archivo importado aquí (data/sepomex-codigos-postales.csv,
 * 145,908 filas) es un espejo comunitario de ese mismo catálogo oficial,
 * publicado en https://github.com/redrbrt/sepomex-zip-codes, con fecha de
 * corte abril 2016 — puede faltarle alguna colonia nueva de los últimos años,
 * pero la cobertura de CPs/municipios/estados es estable. Decisión explícita
 * del equipo (ver prompt de este cambio): usarlo tal cual en vez de esperar
 * el archivo oficial más reciente.
 *
 * Formato del CSV (encabezado real del archivo):
 *   idEstado,estado,idMunicipio,municipio,ciudad,zona,cp,asentamiento,tipo
 * "cp" viene como número sin ceros a la izquierda en ~1,300 filas (p. ej.
 * "1000" en vez de "01000" para Ciudad de México) — se rellena con padStart
 * al importar, ver `normalizarCp`.
 *
 * Idempotente: trunca la tabla antes de insertar, así que correr este script
 * dos veces no duplica filas. Uso: `npm run seed:codigos-postales`.
 */
const RUTA_CSV = join(__dirname, 'data', 'sepomex-codigos-postales.csv');
const TAMANO_LOTE = 2000;

interface FilaSepomex {
  estado: string;
  municipio: string;
  ciudad: string | null;
  codigoPostal: string;
  colonia: string;
  tipoAsentamiento: string | null;
}

function normalizarCp(cpCrudo: string): string {
  return cpCrudo.trim().padStart(5, '0');
}

// Parser CSV mínimo pero correcto: soporta campos entre comillas que
// contienen comas (p. ej. `"Zona Centro"`) y comillas escapadas (`""`) —
// suficiente para este archivo, que no tiene saltos de línea dentro de un
// campo. No se usa una librería externa porque el proyecto no tenía ninguna
// dependencia de parseo de CSV y esto es un script de un solo uso.
function parsearLineaCsv(linea: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let dentroDeComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const char = linea[i];

    if (dentroDeComillas) {
      if (char === '"') {
        if (linea[i + 1] === '"') {
          actual += '"';
          i += 1;
        } else {
          dentroDeComillas = false;
        }
      } else {
        actual += char;
      }
    } else if (char === '"') {
      dentroDeComillas = true;
    } else if (char === ',') {
      campos.push(actual);
      actual = '';
    } else {
      actual += char;
    }
  }
  campos.push(actual);
  return campos;
}

function leerFilas(): FilaSepomex[] {
  const contenido = readFileSync(RUTA_CSV, 'utf-8');
  const lineas = contenido.split(/\r?\n/).filter((linea) => linea.length > 0);

  // lineas[0] es el encabezado: idEstado,estado,idMunicipio,municipio,ciudad,zona,cp,asentamiento,tipo
  const filas: FilaSepomex[] = [];
  const vistos = new Set<string>();

  for (let i = 1; i < lineas.length; i += 1) {
    const columnas = parsearLineaCsv(lineas[i]);
    if (columnas.length < 9) {
      continue;
    }

    const [, estado, , municipio, ciudad, , cp, asentamiento, tipo] = columnas;
    const codigoPostal = normalizarCp(cp);
    const colonia = asentamiento.trim();
    if (!codigoPostal || !colonia) {
      continue;
    }

    // Dedup de filas EXACTAMENTE iguales (81 en el archivo fuente, ver
    // auditoría) — no de colonias homónimas en el mismo CP con tipo distinto,
    // esas sí son información real.
    const clave = `${codigoPostal}|${colonia}|${municipio}|estado=${estado}|${tipo}`;
    if (vistos.has(clave)) {
      continue;
    }
    vistos.add(clave);

    filas.push({
      estado: estado.trim(),
      municipio: municipio.trim(),
      ciudad: ciudad.trim() || null,
      codigoPostal,
      colonia,
      tipoAsentamiento: tipo.trim() || null,
    });
  }

  return filas;
}

async function importar(): Promise<void> {
  const filas = leerFilas();
  console.log(`Leídas ${filas.length} filas de ${RUTA_CSV}.`);

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(CodigoPostal);

  await repo.query('TRUNCATE TABLE "codigos_postales" RESTART IDENTITY');

  let insertadas = 0;
  for (let inicio = 0; inicio < filas.length; inicio += TAMANO_LOTE) {
    const lote = filas.slice(inicio, inicio + TAMANO_LOTE);
    await repo
      .createQueryBuilder()
      .insert()
      .into(CodigoPostal)
      .values(lote)
      .execute();
    insertadas += lote.length;
    console.log(`Insertadas ${insertadas}/${filas.length}...`);
  }

  console.log(`Import completo: ${insertadas} filas en "codigos_postales".`);
  await AppDataSource.destroy();
}

importar().catch((error) => {
  console.error('Error importando el catálogo de códigos postales:', error);
  process.exit(1);
});
