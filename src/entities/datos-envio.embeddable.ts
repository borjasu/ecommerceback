import { Column } from 'typeorm';

/**
 * Snapshot de la dirección de envío en el momento del pedido — copiada desde
 * Direccion al crear el Pedido, no una referencia viva. Si el usuario luego
 * edita o borra esa dirección, el historial del pedido no debe cambiar.
 */
export class DatosEnvio {
  @Column({ type: 'varchar', length: 150, name: 'envio_nombre_completo' })
  nombreCompleto: string;

  @Column({ type: 'varchar', length: 255, name: 'envio_direccion' })
  direccion: string;

  @Column({ type: 'varchar', length: 100, name: 'envio_ciudad' })
  ciudad: string;

  @Column({ type: 'varchar', length: 10, name: 'envio_codigo_postal' })
  codigoPostal: string;

  @Column({ type: 'varchar', length: 20, name: 'envio_telefono' })
  telefono: string;
}
