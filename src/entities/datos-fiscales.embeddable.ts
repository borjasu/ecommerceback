import { Column } from 'typeorm';

/**
 * Todo nullable a propósito: la factura fiscal es opcional (checkbox "Requiero
 * factura fiscal" en el checkout) — un pedido sin factura simplemente deja
 * estas tres columnas en NULL, nunca se le exige al comprador que las llene.
 */
export class DatosFiscales {
  @Column({ type: 'varchar', length: 13, name: 'fiscal_rfc', nullable: true })
  rfc: string | null;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'fiscal_razon_social',
    nullable: true,
  })
  razonSocial: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    name: 'fiscal_regimen',
    nullable: true,
  })
  regimenFiscal: string | null;
}
