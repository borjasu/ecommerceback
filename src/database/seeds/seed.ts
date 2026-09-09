import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import {
  Audiencia,
  Categoria,
  Color,
  Direccion,
  Etiqueta,
  Oferta,
  Producto,
  RolUsuario,
  Talla,
  Usuario,
} from '../../entities';
// Nota: `Categoria` aquí es la ENTIDAD del catálogo dinámico (id/nombre/icono/
// orden, ver entities/categoria.entity.ts), no un enum — Producto.categoria/
// Oferta.categoria siguen siendo strings planos abajo, igual que antes.
import { AplicaA, TipoDescuento } from '../../entities/enums';

const BCRYPT_COST_FACTOR = 12;

// Catálogo dinámico (ver entities/color.entity.ts y talla.entity.ts): se
// siembra primero y los productos de abajo referencian estos nombres —
// PRODUCTOS_SEED usa strings, no la entidad, porque las entidades reales con
// id solo existen después de guardarlas (ver `seed()` más abajo).
const COLORES_SEED: Array<Omit<Color, 'id'>> = [
  { nombre: 'negro', valorHex: '#14110d', activo: true },
  { nombre: 'azul', valorHex: '#2b3a55', activo: true },
  { nombre: 'gris', valorHex: '#8a8a8a', activo: true },
  { nombre: 'beige', valorHex: '#d9c9a3', activo: true },
  { nombre: 'blanco', valorHex: '#f5f5f0', activo: true },
  { nombre: 'cafe', valorHex: '#6b4226', activo: true },
];

const TALLAS_SEED: Array<Omit<Talla, 'id'>> = [
  { nombre: 'S', orden: 1, activo: true },
  { nombre: 'M', orden: 2, activo: true },
  { nombre: 'L', orden: 3, activo: true },
  { nombre: 'XL', orden: 4, activo: true },
];

// Mismos valores/orden que ya sembró la migración AgregarCategoriasDinamicas
// — se listan también aquí (idempotente, como colores/tallas arriba) por si
// este script corre contra una base sin esa migración todavía.
const CATEGORIAS_SEED: Array<Omit<Categoria, 'id'>> = [
  { nombre: 'pantalon', icono: 'pantalon', orden: 1 },
  { nombre: 'playera', icono: 'playera', orden: 2 },
  { nombre: 'camisa', icono: 'camisa', orden: 3 },
  { nombre: 'bermuda', icono: 'bermuda', orden: 4 },
];

interface ProductoSeedData {
  sku: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  audiencia: Audiencia;
  coloresNombres: string[];
  tallasNombres: string[];
  imagenUrl: string;
  imagenes: string[];
  etiqueta: Etiqueta | null;
  destacado: boolean;
}

const PRODUCTOS_SEED: ProductoSeedData[] = [
  {
    sku: 'FJ-PAN-001',
    nombre: 'Pantalón de Vestir Slim',
    descripcion:
      'Pantalón de corte slim en gabardina de algodón, ideal para looks formales y de oficina.',
    precio: 899,
    categoria: 'pantalon',
    audiencia: Audiencia.HOMBRE,
    coloresNombres: ['negro', 'azul'],
    tallasNombres: ['S', 'M', 'L', 'XL'],
    imagenUrl: 'https://picsum.photos/seed/fj1/400/500',
    imagenes: [
      'https://picsum.photos/seed/fj1/400/500',
      'https://picsum.photos/seed/fj1b/400/500',
    ],
    etiqueta: Etiqueta.NUEVO,
    destacado: true,
  },
  {
    sku: 'FJ-PAN-002',
    nombre: 'Pantalón Chino Clásico',
    descripcion:
      'Pantalón chino de algodón con corte recto, un básico versátil para el día a día.',
    precio: 749,
    categoria: 'pantalon',
    audiencia: Audiencia.NINO,
    coloresNombres: ['beige'],
    tallasNombres: ['M', 'L', 'XL'],
    imagenUrl: 'https://picsum.photos/seed/fj2/400/500',
    imagenes: ['https://picsum.photos/seed/fj2/400/500'],
    etiqueta: Etiqueta.ESENCIAL,
    destacado: false,
  },
  {
    sku: 'FJ-PAN-003',
    nombre: 'Pantalón Cargo Utility',
    descripcion:
      'Pantalón cargo con bolsillos funcionales, tela resistente y ajuste cómodo.',
    precio: 999,
    categoria: 'pantalon',
    audiencia: Audiencia.HOMBRE,
    coloresNombres: ['gris', 'negro'],
    tallasNombres: ['S', 'M', 'L'],
    imagenUrl: 'https://picsum.photos/seed/fj3/400/500',
    imagenes: ['https://picsum.photos/seed/fj3/400/500'],
    etiqueta: null,
    destacado: false,
  },
  {
    sku: 'FJ-PLA-004',
    nombre: 'Playera Básica Algodón',
    descripcion:
      'Playera de algodón 100% peinado, suave al tacto y de ajuste regular.',
    precio: 349,
    categoria: 'playera',
    audiencia: Audiencia.NINO,
    coloresNombres: ['blanco'],
    tallasNombres: ['S', 'M', 'L', 'XL'],
    imagenUrl: 'https://picsum.photos/seed/fj4/400/500',
    imagenes: ['https://picsum.photos/seed/fj4/400/500'],
    etiqueta: Etiqueta.ESENCIAL,
    destacado: true,
  },
  {
    sku: 'FJ-PLA-005',
    nombre: 'Playera Estampada Edición Limitada',
    descripcion:
      'Playera con estampado exclusivo de temporada, tela premium y acabado suave.',
    precio: 429,
    categoria: 'playera',
    audiencia: Audiencia.HOMBRE,
    coloresNombres: ['azul'],
    tallasNombres: ['M', 'L'],
    imagenUrl: 'https://picsum.photos/seed/fj5/400/500',
    imagenes: ['https://picsum.photos/seed/fj5/400/500'],
    etiqueta: Etiqueta.NUEVO,
    destacado: true,
  },
  {
    sku: 'FJ-PLA-006',
    nombre: 'Playera Cuello V',
    descripcion:
      'Playera con cuello en V, corte entallado y tejido transpirable.',
    precio: 379,
    categoria: 'playera',
    audiencia: Audiencia.NINO,
    coloresNombres: ['negro', 'blanco'],
    tallasNombres: ['S', 'M', 'L', 'XL'],
    imagenUrl: 'https://picsum.photos/seed/fj6/400/500',
    imagenes: ['https://picsum.photos/seed/fj6/400/500'],
    etiqueta: null,
    destacado: false,
  },
  {
    sku: 'FJ-CAM-007',
    nombre: 'Camisa de Lino Manga Larga',
    descripcion:
      'Camisa confeccionada en lino ligero, perfecta para climas cálidos y looks relajados.',
    precio: 1099,
    categoria: 'camisa',
    audiencia: Audiencia.HOMBRE,
    coloresNombres: ['blanco'],
    tallasNombres: ['S', 'M', 'L'],
    imagenUrl: 'https://picsum.photos/seed/fj7/400/500',
    imagenes: ['https://picsum.photos/seed/fj7/400/500'],
    etiqueta: Etiqueta.NUEVO,
    destacado: false,
  },
  {
    sku: 'FJ-CAM-008',
    nombre: 'Camisa Oxford Clásica',
    descripcion:
      'Camisa Oxford de algodón con cuello abotonado, un básico atemporal para el guardarropa.',
    precio: 949,
    categoria: 'camisa',
    audiencia: Audiencia.NINO,
    coloresNombres: ['azul'],
    tallasNombres: ['S', 'M', 'L', 'XL'],
    imagenUrl: 'https://picsum.photos/seed/fj8/400/500',
    imagenes: ['https://picsum.photos/seed/fj8/400/500'],
    etiqueta: Etiqueta.ESENCIAL,
    destacado: true,
  },
  {
    sku: 'FJ-CAM-009',
    nombre: 'Camisa a Cuadros Franela',
    descripcion:
      'Camisa de franela con estampado a cuadros, cálida y de tacto suave.',
    precio: 899,
    categoria: 'camisa',
    audiencia: Audiencia.HOMBRE,
    coloresNombres: ['cafe'],
    tallasNombres: ['M', 'L', 'XL'],
    imagenUrl: 'https://picsum.photos/seed/fj9/400/500',
    imagenes: ['https://picsum.photos/seed/fj9/400/500'],
    etiqueta: null,
    destacado: false,
  },
  {
    sku: 'FJ-BER-010',
    nombre: 'Bermuda Deportiva',
    descripcion:
      'Bermuda ligera de secado rápido, ideal para actividades al aire libre.',
    precio: 549,
    categoria: 'bermuda',
    audiencia: Audiencia.NINO,
    coloresNombres: ['gris'],
    tallasNombres: ['S', 'M', 'L', 'XL'],
    imagenUrl: 'https://picsum.photos/seed/fj10/400/500',
    imagenes: ['https://picsum.photos/seed/fj10/400/500'],
    etiqueta: Etiqueta.NUEVO,
    destacado: false,
  },
  {
    sku: 'FJ-BER-011',
    nombre: 'Bermuda Denim',
    descripcion: 'Bermuda de mezclilla con corte recto y lavado clásico.',
    precio: 629,
    categoria: 'bermuda',
    audiencia: Audiencia.HOMBRE,
    coloresNombres: ['azul'],
    tallasNombres: ['M', 'L'],
    imagenUrl: 'https://picsum.photos/seed/fj11/400/500',
    imagenes: ['https://picsum.photos/seed/fj11/400/500'],
    etiqueta: Etiqueta.ESENCIAL,
    destacado: true,
  },
  {
    sku: 'FJ-BER-012',
    nombre: 'Bermuda Cargo',
    descripcion:
      'Bermuda tipo cargo con bolsillos laterales y tela resistente.',
    precio: 679,
    categoria: 'bermuda',
    audiencia: Audiencia.NINO,
    coloresNombres: ['beige', 'gris'],
    tallasNombres: ['S', 'M', 'L', 'XL'],
    imagenUrl: 'https://picsum.photos/seed/fj12/400/500',
    imagenes: ['https://picsum.photos/seed/fj12/400/500'],
    etiqueta: null,
    destacado: false,
  },
];

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Conectado a la base de datos. Sembrando datos...');

  const usuariosRepo = AppDataSource.getRepository(Usuario);
  const productosRepo = AppDataSource.getRepository(Producto);
  const ofertasRepo = AppDataSource.getRepository(Oferta);
  const direccionesRepo = AppDataSource.getRepository(Direccion);
  const coloresRepo = AppDataSource.getRepository(Color);
  const tallasRepo = AppDataSource.getRepository(Talla);
  const categoriasRepo = AppDataSource.getRepository(Categoria);

  // ---------- Catálogo dinámico: categorías ----------
  for (const datos of CATEGORIAS_SEED) {
    const existente = await categoriasRepo.findOne({
      where: { nombre: datos.nombre },
    });
    if (!existente) {
      await categoriasRepo.save(categoriasRepo.create(datos));
      console.log(`Categoría creada: ${datos.nombre}`);
    }
  }

  // ---------- Catálogo dinámico: colores y tallas ----------
  for (const datos of COLORES_SEED) {
    const existente = await coloresRepo.findOne({
      where: { nombre: datos.nombre },
    });
    if (!existente) {
      await coloresRepo.save(coloresRepo.create(datos));
      console.log(`Color creado: ${datos.nombre}`);
    }
  }

  for (const datos of TALLAS_SEED) {
    const existente = await tallasRepo.findOne({
      where: { nombre: datos.nombre },
    });
    if (!existente) {
      await tallasRepo.save(tallasRepo.create(datos));
      console.log(`Talla creada: ${datos.nombre}`);
    }
  }

  const todosLosColores = await coloresRepo.find();
  const todasLasTallas = await tallasRepo.find();
  const colorPorNombre = new Map(
    todosLosColores.map((color) => [color.nombre, color]),
  );
  const tallaPorNombre = new Map(
    todasLasTallas.map((talla) => [talla.nombre, talla]),
  );

  // ---------- Vendedor (único vendedor del sistema) ----------
  let vendedor = await usuariosRepo.findOne({
    where: { email: 'vendedor@frankjeans.com' },
  });
  if (!vendedor) {
    vendedor = usuariosRepo.create({
      nombre: 'Frank',
      email: 'vendedor@frankjeans.com',
      passwordHash: await bcrypt.hash('Vendedor123', BCRYPT_COST_FACTOR),
      rol: RolUsuario.VENDEDOR,
    });
    await usuariosRepo.save(vendedor);
    console.log(
      'Usuario vendedor creado: vendedor@frankjeans.com / Vendedor123',
    );
  } else {
    console.log('Usuario vendedor ya existía, se omite.');
  }

  // ---------- Comprador de prueba (para probar el flujo de checkout end-to-end) ----------
  let comprador = await usuariosRepo.findOne({
    where: { email: 'comprador@frankjeans.com' },
  });
  if (!comprador) {
    comprador = usuariosRepo.create({
      nombre: 'Cliente de Prueba',
      email: 'comprador@frankjeans.com',
      passwordHash: await bcrypt.hash('Comprador123', BCRYPT_COST_FACTOR),
      rol: RolUsuario.COMPRADOR,
    });
    await usuariosRepo.save(comprador);
    console.log(
      'Usuario comprador de prueba creado: comprador@frankjeans.com / Comprador123',
    );
  } else {
    console.log('Usuario comprador de prueba ya existía, se omite.');
  }

  // ---------- Dirección de prueba (Puebla) ----------
  const direccionExistente = await direccionesRepo.findOne({
    where: { usuarioId: comprador.id },
  });
  if (!direccionExistente) {
    await direccionesRepo.save(
      direccionesRepo.create({
        usuarioId: comprador.id,
        alias: 'Casa',
        nombreCompleto: comprador.nombre,
        // Colonia/municipio/estado reales del catálogo SEPOMEX para este CP
        // (ver codigos_postales, sembrado aparte con `npm run
        // seed:codigos-postales`) — mismos que devolvería GET
        // /codigos-postales/72000 en el checkout.
        calle: 'Calle 11 Sur',
        numeroExterior: '456',
        numeroInterior: null,
        colonia: 'Centro',
        municipio: 'Puebla',
        estado: 'Puebla',
        codigoPostal: '72000',
        referencias: null,
        telefono: '2221234567',
        predeterminada: true,
      }),
    );
    console.log('Dirección de prueba creada en Puebla.');
  } else {
    console.log('Dirección de prueba ya existía, se omite.');
  }

  // ---------- Productos ----------
  const productosCreados: Producto[] = [];
  for (const datos of PRODUCTOS_SEED) {
    let producto = await productosRepo.findOne({ where: { sku: datos.sku } });
    if (!producto) {
      const { coloresNombres, tallasNombres, ...resto } = datos;
      producto = await productosRepo.save(
        productosRepo.create({
          ...resto,
          coloresDisponibles: coloresNombres.map((nombre) =>
            colorPorNombre.get(nombre)!,
          ),
          tallasDisponibles: tallasNombres.map((nombre) =>
            tallaPorNombre.get(nombre)!,
          ),
        }),
      );
      console.log(`Producto creado: ${datos.sku} — ${datos.nombre}`);
    }
    productosCreados.push(producto);
  }

  // ---------- Ofertas de ejemplo (vigentes) ----------
  const hoy = new Date();
  const hace30Dias = new Date(hoy);
  hace30Dias.setDate(hoy.getDate() - 30);
  const en60Dias = new Date(hoy);
  en60Dias.setDate(hoy.getDate() + 60);
  const aFechaSql = (fecha: Date) => fecha.toISOString().slice(0, 10);

  const productoParaOfertaPuntual = productosCreados.find(
    (p) => p.sku === 'FJ-PAN-001',
  );

  const ofertasSeed: Array<Omit<Oferta, 'id' | 'producto'>> = [
    {
      nombre: 'Lanzamiento: 20% en Pantalón de Vestir Slim',
      tipoDescuento: TipoDescuento.PORCENTAJE,
      valor: 20,
      aplicaA: AplicaA.PRODUCTO,
      productoId: productoParaOfertaPuntual?.id ?? null,
      categoria: null,
      audiencia: null,
      fechaInicio: aFechaSql(hace30Dias),
      fechaFin: aFechaSql(en60Dias),
      activa: true,
    },
    {
      nombre: 'Temporada Playeras: $50 de descuento',
      tipoDescuento: TipoDescuento.MONTO_FIJO,
      valor: 50,
      aplicaA: AplicaA.CATEGORIA,
      productoId: null,
      categoria: 'playera',
      audiencia: null,
      fechaInicio: aFechaSql(hace30Dias),
      fechaFin: aFechaSql(en60Dias),
      activa: true,
    },
    {
      nombre: 'Regreso a Clases Niño: 15% de descuento',
      tipoDescuento: TipoDescuento.PORCENTAJE,
      valor: 15,
      aplicaA: AplicaA.AUDIENCIA,
      productoId: null,
      categoria: null,
      audiencia: Audiencia.NINO,
      fechaInicio: aFechaSql(hace30Dias),
      fechaFin: aFechaSql(en60Dias),
      activa: true,
    },
  ];

  for (const datos of ofertasSeed) {
    const existente = await ofertasRepo.findOne({
      where: { nombre: datos.nombre },
    });
    if (!existente) {
      await ofertasRepo.save(ofertasRepo.create(datos));
      console.log(`Oferta creada: ${datos.nombre}`);
    }
  }

  console.log('Seed completado.');
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('Error corriendo el seed:', error);
  process.exit(1);
});
