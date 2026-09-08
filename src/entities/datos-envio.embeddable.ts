import { Column } from 'typeorm';

/**
 * Snapshot de la dirección de envío en el momento del pedido — copiada desde
 * Direccion al crear el Pedido, no una referencia viva. Si el usuario luego
 * edita o borra esa dirección, el historial del pedido no debe cambiar.
 *
 * `direccion` y `ciudad` se conservan (calculados a partir de los campos
 * estructurados de abajo, ver OrdersService.crear) por compatibilidad: el
 * panel del vendedor (vendedor/pedidos) y "Mis pedidos" del comprador ya los
 * leen tal cual y no forman parte de este cambio — así ninguna de esas dos
 * vistas necesita tocarse para seguir mostrando la dirección correctamente.
 */
export class DatosEnvio {
  @Column({ type: 'varchar', length: 150, name: 'envio_nombre_completo' })
  nombreCompleto: string;

  @Column({ type: 'varchar', length: 255, name: 'envio_direccion' })
  direccion: string;

  @Column({ type: 'varchar', length: 100, name: 'envio_ciudad' })
  ciudad: string;

  @Column({ type: 'varchar', length: 200, name: 'envio_calle', nullable: true })
  calle: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'envio_numero_exterior',
    nullable: true,
  })
  numeroExterior: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'envio_numero_interior',
    nullable: true,
  })
  numeroInterior: string | null;

  @Column({
    type: 'varchar',
    length: 120,
    name: 'envio_colonia',
    nullable: true,
  })
  colonia: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'envio_municipio',
    nullable: true,
  })
  municipio: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'envio_estado',
    nullable: true,
  })
  estado: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'envio_referencias',
    nullable: true,
  })
  referencias: string | null;

  @Column({ type: 'varchar', length: 10, name: 'envio_codigo_postal' })
  codigoPostal: string;

  @Column({ type: 'varchar', length: 20, name: 'envio_telefono' })
  telefono: string;
}
