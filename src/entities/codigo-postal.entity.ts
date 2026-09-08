import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Catálogo Nacional de Códigos Postales (SEPOMEX) — tabla de solo lectura
 * usada para autocompletar estado/municipio/colonia en el checkout sin
 * depender de un proveedor externo de pago (se descartó un mapa interactivo
 * tipo Mapbox por el costo recurrente que implica).
 *
 * Un mismo código postal tiene VARIAS filas, una por cada colonia que cubre
 * (ver PostalCodesService.buscarPorCp, que agrupa por cp y regresa la lista
 * de colonias). No es un catálogo que se edite desde la app — se puebla una
 * sola vez con `npm run seed:codigos-postales` (ver
 * database/seeds/importar-codigos-postales.ts para la fuente exacta del
 * archivo y su fecha de corte) y no tiene ningún endpoint de escritura.
 */
@Entity('codigos_postales')
export class CodigoPostal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 5, name: 'codigo_postal' })
  codigoPostal: string;

  @Column({ type: 'varchar', length: 120 })
  colonia: string;

  @Column({ type: 'varchar', length: 100 })
  municipio: string;

  @Column({ type: 'varchar', length: 100 })
  estado: string;

  // SEPOMEX distingue "ciudad" de "municipio" solo cuando existe una zona
  // urbana con nombre propio dentro del municipio (p. ej. municipio
  // "Álvaro Obregón" -> ciudad "Ciudad de México") — casi siempre viene
  // igual al municipio o vacío, así que se guarda pero no se expone en la
  // respuesta pública del endpoint (ver PostalCodesController).
  @Column({ type: 'varchar', length: 100, nullable: true })
  ciudad: string | null;

  // Texto libre, no enum: el catálogo trae ~25 valores distintos (Colonia,
  // Fraccionamiento, Unidad habitacional, Ejido, Zona industrial, ...) y no
  // hay razón para restringirlos aquí, solo se muestran tal cual al comprador.
  @Column({
    type: 'varchar',
    length: 60,
    name: 'tipo_asentamiento',
    nullable: true,
  })
  tipoAsentamiento: string | null;
}
