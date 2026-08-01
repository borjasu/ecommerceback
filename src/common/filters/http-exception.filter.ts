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
      // Errores no controlados (p. ej. QueryFailedError de TypeORM): se registran
      // completos en el log del servidor, pero al cliente solo llega un 500 genérico.
      this.logger.error(exception.message, exception.stack);
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
}
