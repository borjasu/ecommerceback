import { Column } from 'typeorm';

/**
 * Todo nullable: se llena cuando el módulo vendedor genera la guía en Skydropx
 * desde /vendedor/pedidos (fuera del alcance de este backend cliente). Mientras
 * eso no pase, todas las columnas quedan NULL y el pedido se ve sin info de envío.
 */
export class InfoEnvio {
  @Column({
    type: 'varchar',
    length: 60,
    name: 'envio_paqueteria',
    nullable: true,
  })
  paqueteria: string | null;

  @Column({
    type: 'varchar',
    length: 120,
    name: 'envio_id_skydropx',
    nullable: true,
  })
  idEnvioSkydropx: string | null;

  @Column({
    type: 'varchar',
    length: 120,
    name: 'envio_numero_guia',
    nullable: true,
  })
  numeroGuia: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'envio_url_etiqueta',
    nullable: true,
  })
  urlEtiqueta: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'envio_url_rastreo',
    nullable: true,
  })
  urlRastreo: string | null;

  @Column({ type: 'timestamptz', name: 'envio_fecha_envio', nullable: true })
  fechaEnvio: Date | null;
}
