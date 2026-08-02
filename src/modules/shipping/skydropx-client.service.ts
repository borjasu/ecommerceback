import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

export interface DireccionSkydropx {
  street1: string;
  postal_code: string;
  area_level1: string;
  area_level2: string;
  area_level3: string;
  country_code: string;
}

/** Para crear un envío (no solo cotizar) Skydropx exige además datos de contacto. */
export interface ContactoDireccionSkydropx extends DireccionSkydropx {
  name: string;
  phone: string;
  email: string;
  reference: string;
}

export interface EnvioSkydropx {
  id: string;
  workflowStatus: string;
  carrierName: string;
  trackingNumber: string | null;
  labelUrl: string | null;
  trackingUrlProvider: string | null;
  // Estado de rastreo real del paquete (created/picked_up/in_transit/...) —
  // viene en `included[].attributes.tracking_status` de la respuesta de
  // Skydropx, verificado en vivo el 2026-08-02 contra GET /api/v1/shipments/:id
  // y GET /api/v1/shipments?tracking_number=. Se guarda tal cual como texto
  // libre (ver Pedido.infoEnvio.trackingStatus) en vez de un enum estricto en
  // BD: no hay documentación oficial confirmada con la lista completa y
  // exacta de valores posibles, y un valor inesperado no debe tumbar la
  // actualización del pedido.
  trackingStatus: string | null;
}

export interface ParcelSkydropx {
  weight: number;
  height: number;
  width: number;
  length: number;
}

export interface RateSkydropx {
  id: string;
  success: boolean;
  status: string;
  provider_display_name: string;
  provider_service_name: string;
  total: string | null;
  days: number | null;
  // Si ESTA tarifa específica implica que Skydropx programe recolección a
  // domicilio en el origen — verificado en vivo contra el sandbox
  // (sb-pro.skydropx.com) el 2026-08-02: para una misma paquetería puede haber
  // varias tarifas que solo difieren en esto (p. ej. Paquetexpress "Nacional"
  // vs "Nacional Sin Recolección"), que es una decisión de OPERACIÓN del
  // vendedor, no una opción real distinta que el comprador deba elegir. Ver
  // ShippingService.mapearOpciones, que filtra por esto usando
  // ENVIO_REQUIERE_PICKUP en vez de exponerlo al comprador.
  pickup: boolean;
}

export interface CotizacionSkydropx {
  id: string;
  is_completed: boolean;
  rates: RateSkydropx[];
}

interface TokenCacheado {
  accessToken: string;
  expiraEn: number; // epoch ms
}

const INTENTOS_POLLING = 10;
const ESPERA_ENTRE_POLLS_MS = 2000;
const INTENTO_MINIMO_ANTES_DE_DEVOLVER_PARCIAL = 3;

const INTENTOS_POLLING_ENVIO = 12;
const ESPERA_ENTRE_POLLS_ENVIO_MS = 3000;

// Códigos requeridos por Skydropx/SAT para generar una guía real (Carta Porte):
// - package_type "4G" es el código UN estándar de "caja de cartón/fibra" — el
//   empaque genérico que usa cualquier prenda de ropa en una caja normal.
// - consignment_note "01010101" es el código SAT c_ClaveProdServ para
//   "No existe en el catálogo" — el genérico que se usa cuando no importa
//   declarar la clave de producto exacta para efectos de la guía de envío.
// Verificados contra el sandbox real: sin estos valores exactos, Skydropx
// responde 422 (ninguno de los dos se documenta con su lista de valores
// válidos en pro.skydropx.com/es-MX/api-docs).
const PACKAGE_TYPE_DEFAULT = '4G';
const CONSIGNMENT_NOTE_DEFAULT = '01010101';

interface RespuestaEnvioSkydropx {
  data: {
    id: string;
    attributes: { carrier_name: string; workflow_status: string };
  };
  included: Array<{
    type: string;
    attributes?: {
      tracking_number: string | null;
      label_url: string | null;
      tracking_url_provider: string | null;
      tracking_status?: string | null;
    };
  }>;
}

/**
 * Adaptador de bajo nivel contra la API REST de Skydropx PRO — no existe SDK oficial
 * de Node publicado en npm (verificado: no hay paquete `skydropx` ni `@skydropx/*`
 * en el registro de npm), así que se consume el REST directamente con HttpService.
 *
 * Contrato verificado en vivo el 2026-08-02 (re-verificado tras un reporte de bug
 * sobre el host — ver nota abajo, se confirmó que NO había que cambiarlo):
 * - Host: `sb-pro.skydropx.com` para sandbox. Se probó también `api-pro.skydropx.com`
 *   (que alguna vez se sugirió como "el host correcto") y ese host SÍ responde con
 *   un error Doorkeeper válido, pero RECHAZA nuestras credenciales de sandbox con
 *   401 "cliente desconocido" — es el host de PRODUCCIÓN, no el de sandbox. Con las
 *   credenciales TEST-* actuales, `sb-pro.skydropx.com` es el host correcto y ya
 *   viene funcionando (OAuth + cotizaciones + guías reales, verificado en vivo).
 * - OAuth: POST /api/v1/oauth/token con { client_id, client_secret, grant_type } en JSON.
 *   Token dura 2h (expires_in: 7200), se cachea en memoria con 5 min de margen.
 * - Límite documentado: 2 solicitudes/segundo — ver `espaciarLlamada`, que encola y
 *   espacia TODAS las llamadas salientes de este servicio (oauth, cotización, guía,
 *   rastreo), no solo el polling.
 * - Cotización: POST /api/v1/quotations con { quotation: { address_from, address_to, parcel } },
 *   cada dirección requiere country_code/postal_code/area_level1(estado)/area_level2(ciudad)/
 *   area_level3(colonia)/street1 — area_level3 es obligatorio, si falta responde 422.
 * - La cotización es ASÍNCRONA: la respuesta inicial trae is_completed:false y cada rate en
 *   status:"pending". Hay que hacer polling a GET /api/v1/quotations/:id hasta is_completed:true,
 *   y quedarse solo con los rates de success:true (el resto son paqueterías sin cobertura
 *   para esa ruta, no errores).
 * - Rastreo: el campo `tracking_status` (created/picked_up/in_transit/...) viene dentro de
 *   `included[].attributes` del recurso "package" en la respuesta de GET /api/v1/shipments/:id
 *   (mismo endpoint que ya se usaba para esperar a que la guía se generara) — no hace falta
 *   un endpoint nuevo para consultarlo bajo demanda, ver `obtenerEstadoRastreo`.
 *
 * Toda la forma de estos payloads vive aislada en este único archivo para que un ajuste
 * futuro de la API de Skydropx no toque ShippingService ni el resto de la app.
 */
// Límite documentado de Skydropx: 2 solicitudes/segundo. Se aplica aquí, no
// solo confiando en los intervalos de polling (que ya son más lentos que
// esto), porque varias cotizaciones/guías de distintos compradores pueden
// solaparse en el tiempo y sumar más de 2/s entre todas si nadie las espacia
// globalmente a nivel de esta única instancia del proceso.
const INTERVALO_MINIMO_ENTRE_LLAMADAS_MS = 500;

@Injectable()
export class SkydropxClientService {
  private readonly logger = new Logger('SkydropxClient');
  private tokenCacheado: TokenCacheado | null = null;

  // Cola simple: cada llamada se encadena después de la anterior y espera lo
  // necesario para respetar INTERVALO_MINIMO_ENTRE_LLAMADAS_MS, sin importar
  // cuántas peticiones concurrentes de distintos usuarios lleguen a la vez.
  private colaLlamadas: Promise<void> = Promise.resolve();
  private ultimaLlamadaEn = 0;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private async espaciarLlamada<T>(llamada: () => Promise<T>): Promise<T> {
    const miTurno = this.colaLlamadas.then(async () => {
      const espera = Math.max(
        0,
        this.ultimaLlamadaEn + INTERVALO_MINIMO_ENTRE_LLAMADAS_MS - Date.now(),
      );
      if (espera > 0) {
        await new Promise((resolve) => setTimeout(resolve, espera));
      }
      this.ultimaLlamadaEn = Date.now();
    });
    this.colaLlamadas = miTurno;
    await miTurno;
    return llamada();
  }

  async obtenerCotizacion(
    origen: DireccionSkydropx,
    destino: DireccionSkydropx,
    parcel: ParcelSkydropx,
  ): Promise<CotizacionSkydropx> {
    const token = await this.obtenerAccessToken();
    const baseUrl = this.config.get<string>('SKYDROPX_API_URL');

    try {
      const creada = await this.espaciarLlamada(() =>
        firstValueFrom(
          this.http.post<CotizacionSkydropx>(
            `${baseUrl}/api/v1/quotations`,
            { quotation: { address_from: origen, address_to: destino, parcel } },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        ),
      );

      // await explícito: sin esto, un rechazo de esperarACompletarse() no
      // sería atrapado por este catch (una promesa retornada sin await desde
      // un try no dispara su catch), y se colaría un error sin loguear.
      return await this.esperarACompletarse(creada.data.id, token, baseUrl!);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(
        'Error cotizando envío con Skydropx',
        this.detalleError(error),
      );
      throw new ServiceUnavailableException(
        'No pudimos cotizar el envío en este momento. Intenta de nuevo.',
      );
    }
  }

  async obtenerCotizacionPorId(
    cotizacionId: string,
  ): Promise<CotizacionSkydropx | null> {
    const baseUrl = this.config.get<string>('SKYDROPX_API_URL');

    try {
      // A diferencia de obtenerCotizacion() (la cotización inicial, donde un fallo
      // de Skydropx sí debe ser un 503 explícito), aquí el token también se pide
      // dentro del try: si Skydropx está caído o mal configurado durante la
      // REVALIDACIÓN de una cotización ya existente, se trata igual que "no se
      // pudo confirmar esa cotización" → OrdersService la rechaza con un 400 claro
      // ("cotización expiró o no es válida") en vez de un 503 genérico.
      const token = await this.obtenerAccessToken();
      const respuesta = await this.espaciarLlamada(() =>
        firstValueFrom(
          this.http.get<CotizacionSkydropx>(
            `${baseUrl}/api/v1/quotations/${cotizacionId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        ),
      );

      return respuesta.data;
    } catch (error) {
      this.logger.warn(
        `No se pudo revalidar la cotización ${cotizacionId} contra Skydropx`,
        this.detalleError(error),
      );
      return null;
    }
  }

  /**
   * Hace polling a la cotización mientras Skydropx consulta a cada paquetería.
   * En el sandbox se observó que `is_completed` puede tardar 30s+ en ponerse en
   * true porque espera a que TODAS las paqueterías respondan (incluidas las que
   * nunca tienen cobertura para esa ruta) — pero ya hay tarifas con success:true
   * disponibles mucho antes. Por UX, no hacemos esperar al cliente a la paquetería
   * más lenta: en cuanto haya al menos una tarifa utilizable (tras un mínimo de
   * intentos, para no devolver solo la primera que llegue) o is_completed sea
   * true, se devuelve lo que haya.
   */
  private async esperarACompletarse(
    cotizacionId: string,
    token: string,
    baseUrl: string,
  ): Promise<CotizacionSkydropx> {
    let ultimaRespuesta: CotizacionSkydropx | null = null;

    for (let intento = 0; intento < INTENTOS_POLLING; intento += 1) {
      const respuesta = await this.espaciarLlamada(() =>
        firstValueFrom(
          this.http.get<CotizacionSkydropx>(
            `${baseUrl}/api/v1/quotations/${cotizacionId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        ),
      );
      ultimaRespuesta = respuesta.data;

      if (respuesta.data.is_completed) {
        return respuesta.data;
      }

      const hayTarifasUtilizables = respuesta.data.rates.some(
        (rate) => rate.success && rate.total != null,
      );
      if (
        hayTarifasUtilizables &&
        intento >= INTENTO_MINIMO_ANTES_DE_DEVOLVER_PARCIAL
      ) {
        return respuesta.data;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, ESPERA_ENTRE_POLLS_MS),
      );
    }

    // Se agotaron los intentos: si para entonces ya había alguna tarifa utilizable,
    // mejor ofrecer esas que fallar por completo.
    const huboAlgunaTarifa = ultimaRespuesta?.rates.some(
      (rate) => rate.success && rate.total != null,
    );
    if (ultimaRespuesta && huboAlgunaTarifa) {
      return ultimaRespuesta;
    }

    throw new ServiceUnavailableException(
      'La cotización de envío está tardando más de lo normal. Intenta de nuevo en unos segundos.',
    );
  }

  /**
   * Crea el envío real (guía) a partir de una cotización y una tarifa elegida.
   * Contrato verificado en vivo el 2026-08-01: POST /api/v1/shipments con
   * { shipment: { quotation_id, rate_id, address_from, address_to, packages } },
   * cada dirección necesita además name/phone/email/reference (la cotización no
   * los pedía). Igual que la cotización, es asíncrono: hay que hacer polling a
   * GET /api/v1/shipments/:id hasta que workflow_status sea "success" para
   * tener numeroGuia/urlEtiqueta/urlRastreo.
   */
  async crearEnvio(
    cotizacionId: string,
    rateId: string,
    origen: ContactoDireccionSkydropx,
    destino: ContactoDireccionSkydropx,
  ): Promise<EnvioSkydropx> {
    const token = await this.obtenerAccessToken();
    const baseUrl = this.config.get<string>('SKYDROPX_API_URL');

    try {
      const creado = await this.espaciarLlamada(() =>
        firstValueFrom(
          this.http.post<RespuestaEnvioSkydropx>(
            `${baseUrl}/api/v1/shipments`,
            {
              shipment: {
                quotation_id: cotizacionId,
                rate_id: rateId,
                address_from: origen,
                address_to: destino,
                packages: [
                  {
                    package_number: 1,
                    package_type: PACKAGE_TYPE_DEFAULT,
                    consignment_note: CONSIGNMENT_NOTE_DEFAULT,
                  },
                ],
              },
            },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        ),
      );

      return await this.esperarEnvioCompletarse(
        creado.data.data.id,
        token,
        baseUrl!,
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(
        'Error generando la guía de envío con Skydropx',
        this.detalleError(error),
      );
      throw new ServiceUnavailableException(
        'No pudimos generar la guía de envío. Intenta de nuevo.',
      );
    }
  }

  private async esperarEnvioCompletarse(
    shipmentId: string,
    token: string,
    baseUrl: string,
  ): Promise<EnvioSkydropx> {
    for (let intento = 0; intento < INTENTOS_POLLING_ENVIO; intento += 1) {
      const respuesta = await this.espaciarLlamada(() =>
        firstValueFrom(
          this.http.get<RespuestaEnvioSkydropx>(
            `${baseUrl}/api/v1/shipments/${shipmentId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          ),
        ),
      );

      const { workflow_status: workflowStatus, carrier_name: carrierName } =
        respuesta.data.data.attributes;
      const paquete = respuesta.data.included.find(
        (item) => item.type === 'package',
      );

      if (workflowStatus === 'success') {
        return {
          id: respuesta.data.data.id,
          workflowStatus,
          carrierName,
          trackingNumber: paquete?.attributes?.tracking_number ?? null,
          labelUrl: paquete?.attributes?.label_url ?? null,
          trackingUrlProvider:
            paquete?.attributes?.tracking_url_provider ?? null,
          trackingStatus: paquete?.attributes?.tracking_status ?? null,
        };
      }

      if (workflowStatus === 'failed' || workflowStatus === 'error') {
        throw new ServiceUnavailableException(
          'Skydropx no pudo generar la guía para este envío.',
        );
      }

      await new Promise((resolve) =>
        setTimeout(resolve, ESPERA_ENTRE_POLLS_ENVIO_MS),
      );
    }

    throw new ServiceUnavailableException(
      'La generación de la guía está tardando más de lo normal. Intenta de nuevo en unos segundos.',
    );
  }

  /**
   * Consulta bajo demanda el estado de rastreo de un envío YA generado — usada
   * como respaldo de GET /pedidos/:id/rastreo cuando el webhook no llega o no
   * está configurado en el sandbox (ver ShippingService.consultarRastreo).
   * Mismo endpoint y forma de respuesta que usa esperarEnvioCompletarse
   * (GET /api/v1/shipments/:id), verificado en vivo el 2026-08-02.
   */
  async obtenerEstadoRastreo(shipmentId: string): Promise<string | null> {
    const token = await this.obtenerAccessToken();
    const baseUrl = this.config.get<string>('SKYDROPX_API_URL');

    try {
      const respuesta = await this.espaciarLlamada(() =>
        firstValueFrom(
          this.http.get<RespuestaEnvioSkydropx>(
            `${baseUrl}/api/v1/shipments/${shipmentId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        ),
      );
      const paquete = respuesta.data.included.find(
        (item) => item.type === 'package',
      );
      return paquete?.attributes?.tracking_status ?? null;
    } catch (error) {
      this.logger.warn(
        `No se pudo consultar el rastreo del envío ${shipmentId} contra Skydropx`,
        this.detalleError(error),
      );
      return null;
    }
  }

  private async obtenerAccessToken(): Promise<string> {
    const ahora = Date.now();
    // Token dura 2h (expires_in: 7200) — margen generoso para no arriesgar
    // usar uno a punto de vencer a media petición.
    const MARGEN_EXPIRACION_MS = 5 * 60 * 1000;

    if (
      this.tokenCacheado &&
      this.tokenCacheado.expiraEn - MARGEN_EXPIRACION_MS > ahora
    ) {
      return this.tokenCacheado.accessToken;
    }

    const baseUrl = this.config.get<string>('SKYDROPX_API_URL');

    try {
      const respuesta = await this.espaciarLlamada(() =>
        firstValueFrom(
          this.http.post<{ access_token: string; expires_in: number }>(
            `${baseUrl}/api/v1/oauth/token`,
            {
              client_id: this.config.get<string>('SKYDROPX_CLIENT_ID'),
              client_secret: this.config.get<string>('SKYDROPX_CLIENT_SECRET'),
              grant_type: 'client_credentials',
            },
          ),
        ),
      );

      this.tokenCacheado = {
        accessToken: respuesta.data.access_token,
        expiraEn: Date.now() + respuesta.data.expires_in * 1000,
      };

      return this.tokenCacheado.accessToken;
    } catch (error) {
      this.logger.error(
        'Error obteniendo token OAuth de Skydropx',
        this.detalleError(error),
      );
      throw new ServiceUnavailableException(
        'No pudimos conectar con el servicio de envíos. Intenta de nuevo.',
      );
    }
  }

  private detalleError(error: unknown): string {
    if (error instanceof AxiosError) {
      return `${error.response?.status ?? 's/n'} ${JSON.stringify(error.response?.data ?? error.message)}`;
    }
    return String(error);
  }
}
