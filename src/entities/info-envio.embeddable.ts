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

  // Texto libre, NO un enum de Postgres a propósito: no hay documentación
  // oficial de Skydropx confirmada con la lista completa y exacta de
  // valores posibles (ver skydropx-client.service.ts) — un valor inesperado
  // no debe romper la actualización del pedido. Se actualiza por webhook
  // (POST /envios/webhook) o por consulta bajo demanda (GET /pedidos/:id/rastreo).
  @Column({
    type: 'varchar',
    length: 40,
    name: 'envio_tracking_status',
    nullable: true,
  })
  trackingStatus: string | null;
}
