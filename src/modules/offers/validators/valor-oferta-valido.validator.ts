import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { TipoDescuento } from '../../../entities';

const PORCENTAJE_MAXIMO = 100;
const MONTO_FIJO_MAXIMO = 100_000;

interface DtoConTipoDescuento {
  tipoDescuento?: TipoDescuento;
}

/**
 * Valida `valor` según `tipoDescuento`: si es porcentaje, entre 0.01 y 100
 * (nunca "500% de descuento"); si es monto fijo, positivo y con un tope
 * razonable (nunca un valor absurdo que deje el precio final en 0 o negativo
 * por error de captura). Ambos casos ya quedan protegidos además por
 * Math.max(0, ...) en OffersService al calcular el precio final, pero esto
 * evita guardar la oferta inválida desde el origen.
 */
export function ValorOfertaValido(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'valorOfertaValido',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'number' || Number.isNaN(value)) {
            return false;
          }
          const dto = args.object as DtoConTipoDescuento;
          if (dto.tipoDescuento === TipoDescuento.PORCENTAJE) {
            return value > 0 && value <= PORCENTAJE_MAXIMO;
          }
          return value > 0 && value <= MONTO_FIJO_MAXIMO;
        },
        defaultMessage(args: ValidationArguments): string {
          const dto = args.object as DtoConTipoDescuento;
          return dto.tipoDescuento === TipoDescuento.PORCENTAJE
            ? `valor debe ser un porcentaje entre 0.01 y ${PORCENTAJE_MAXIMO}.`
            : `valor debe ser un monto positivo, hasta ${MONTO_FIJO_MAXIMO}.`;
        },
      },
    });
  };
}
