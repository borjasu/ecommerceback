import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface RespuestaError {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
}

/**
 * Filtro global de excepciones. Nunca deja pasar stack traces, nombres de archivo,
 * ni mensajes internos de TypeORM/Postgres al cliente (evita "Exposición de datos
 * sensibles" del OWASP Top 10 vía mensajes de error verbosos). Cualquier error que
 * no sea una HttpException conocida se convierte en un 500 genérico; el detalle real
 * solo se registra en el log del servidor.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] =
      'Ocurrió un error inesperado. Intenta de nuevo.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const respuesta = exception.getResponse();

      if (typeof respuesta === 'string') {
        message = respuesta;
      } else if (
        respuesta &&
        typeof respuesta === 'object' &&
        'message' in respuesta
      ) {
        message = (respuesta as { message: string | string[] }).message;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      // Errores no controlados (p. ej. QueryFailedError de TypeORM, o
      // PayloadTooLargeError de body-parser cuando el JSON supera el límite
      // configurado en main.ts): se registran completos en el log del
      // servidor con stack incluido para diagnóstico rápido.
      this.logger.error(exception.message, exception.stack);

      // Excepción puntual: errores de tipo http-errors (body-parser, etc.)
      // traen su propio `.status`/`.statusCode` 4xx — ahí SÍ tiene sentido
      // devolverlo con un mensaje seguro y accionable en vez de un 500 genérico,
      // porque el problema es del request del cliente, no un bug del servidor.
      const estadoDeLibreria = this.extraerEstadoCliente(exception);
      if (estadoDeLibreria !== null) {
        status = estadoDeLibreria;
        message =
          estadoDeLibreria === HttpStatus.PAYLOAD_TOO_LARGE
            ? 'El archivo es demasiado grande. Máximo permitido: 10MB.'
            : 'Solicitud inválida.';
      }
    } else {
      this.logger.error('Excepción desconocida', JSON.stringify(exception));
    }

    const cuerpo: RespuestaError = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(cuerpo);
  }

  private extraerEstadoCliente(exception: Error): number | null {
    const posible = exception as { status?: unknown; statusCode?: unknown };
    const estado =
      typeof posible.status === 'number'
        ? posible.status
        : typeof posible.statusCode === 'number'
          ? posible.statusCode
          : null;

    return estado !== null && estado >= 400 && estado < 500 ? estado : null;
  }
}
