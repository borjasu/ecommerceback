import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { BadGatewayException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { EstadoPago, Pedido, Usuario } from '../../entities';
import { ProcesarPagoDto } from './dto/procesar-pago.dto';
import { CrearPreferenciaDto } from './dto/crear-preferencia.dto';

// El SDK de mercadopago se mockea completo: PaymentsService construye
// `new Payment(mpConfig)`/`new Preference(mpConfig)` directamente en su
// constructor (no vienen inyectados), así que la única forma de controlar lo
// que "Mercado Pago responde" en un test es interceptar la clase antes de
// que PaymentsService la importe.
const paymentClienteMock = { create: jest.fn(), get: jest.fn() };
const preferenceClienteMock = { create: jest.fn() };

jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(),
  Payment: jest.fn(() => paymentClienteMock),
  Preference: jest.fn(() => preferenceClienteMock),
  InvalidWebhookSignatureError: class InvalidWebhookSignatureError extends Error {},
  WebhookSignatureValidator: { validate: jest.fn() },
}));

// Importado DESPUÉS del jest.mock de arriba a propósito (jest.mock se hoistea
// antes que los imports, pero el orden explícito aquí deja claro que
// PaymentsService recibe el mock, no el SDK real).
import { PaymentsService } from './payments.service';

function crearPedido(overrides: Partial<Pedido> = {}): Pedido {
  return {
    id: 'pedido-1',
    usuarioId: 'usuario-1',
    numeroPedido: 'FJ-0001',
    total: 500,
    estadoPago: EstadoPago.PENDIENTE,
    ...overrides,
  } as Pedido;
}

function crearDto(overrides: Partial<ProcesarPagoDto> = {}): ProcesarPagoDto {
  return {
    pedidoId: 'pedido-1',
    transaction_amount: 500,
    payment_method_id: 'visa',
    token: 'tok_test',
    payer: { email: 'compradora@test.com' },
    ...overrides,
  } as ProcesarPagoDto;
}

describe('PaymentsService.procesar', () => {
  let service: PaymentsService;
  let pedidos: jest.Mocked<Pick<Repository<Pedido>, 'findOne' | 'update'>>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    pedidos = { findOne: jest.fn(), update: jest.fn() };
    const usuarios = { findOne: jest.fn() } as unknown as Repository<Usuario>;
    const config = { get: jest.fn(() => 'valor-de-prueba') } as unknown as ConfigService;

    service = new PaymentsService(
      pedidos as unknown as Repository<Pedido>,
      usuarios,
      config,
    );
  });

  it('devuelve "aprobado" y marca el pedido como pagado cuando Mercado Pago aprueba el cobro (camino feliz, sin regresión)', async () => {
    const pedido = crearPedido();
    pedidos.findOne
      .mockResolvedValueOnce(pedido) // lookup del pedido al inicio de procesar()
      .mockResolvedValueOnce(pedido); // lookup dentro de verificarYActualizarPorPaymentId()

    paymentClienteMock.create.mockResolvedValueOnce({
      id: 123,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 500,
      payment_method_id: 'visa',
    });
    paymentClienteMock.get.mockResolvedValueOnce({
      status: 'approved',
      external_reference: 'FJ-0001',
    });

    const resultado = await service.procesar('usuario-1', crearDto());

    expect(resultado).toEqual({ resultado: 'aprobado' });
    expect(pedidos.update).toHaveBeenCalledWith(
      { id: 'pedido-1' },
      { estadoPago: EstadoPago.PAGADO },
    );
  });

  it('responde con un error controlado (no un 500 crudo) cuando Mercado Pago falla al crear el cobro', async () => {
    pedidos.findOne.mockResolvedValueOnce(crearPedido());

    // Forma real de lo que lanza RestClient.fetch del SDK ante una respuesta
    // no-2xx: `throw await response.json()` — un objeto plano, no un Error.
    paymentClienteMock.create.mockRejectedValueOnce({
      message: 'Invalid token',
      status: 400,
      cause: [{ code: '2034', description: 'invalid token' }],
    });

    await expect(service.procesar('usuario-1', crearDto())).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    // El pedido nunca se toca si el cobro ni siquiera se pudo crear.
    expect(pedidos.update).not.toHaveBeenCalled();
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('degrada a "pendiente" (no un 500) cuando el cobro sí se creó en Mercado Pago pero la doble verificación posterior falla', async () => {
    pedidos.findOne.mockResolvedValueOnce(crearPedido());

    paymentClienteMock.create.mockResolvedValueOnce({
      id: 123,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 500,
      payment_method_id: 'visa',
    });
    // Simula el hiccup transitorio real: la segunda llamada de red a
    // Mercado Pago (el GET de verificación) falla, p. ej. por timeout.
    paymentClienteMock.get.mockRejectedValueOnce(new Error('fetch failed'));

    const resultado = await service.procesar('usuario-1', crearDto());

    expect(resultado).toEqual({ resultado: 'pendiente' });
    expect(pedidos.update).not.toHaveBeenCalled();
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('usa una idempotencyKey distinta por token/tarjeta, no solo por pedido, para que un reintento con otra tarjeta sí se cobre', async () => {
    const pedido = crearPedido();
    pedidos.findOne
      .mockResolvedValueOnce(pedido)
      .mockResolvedValueOnce(pedido);
    paymentClienteMock.create.mockResolvedValueOnce({
      id: 1,
      status: 'rejected',
      status_detail: 'cc_rejected_other_reason',
      transaction_amount: 500,
      payment_method_id: 'visa',
    });
    paymentClienteMock.get.mockResolvedValueOnce({
      status: 'rejected',
      external_reference: 'FJ-0001',
    });

    await service.procesar('usuario-1', crearDto({ token: 'tok_rechazado' }));
    expect(paymentClienteMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestOptions: { idempotencyKey: 'pedido-1:tok_rechazado' },
      }),
    );

    // "Intentar de nuevo" con OTRA tarjeta: mismo pedido, token distinto —
    // la key debe cambiar, si no Mercado Pago devolvería el rechazo cacheado
    // del intento anterior en vez de cobrar la tarjeta nueva.
    pedidos.findOne
      .mockResolvedValueOnce(pedido)
      .mockResolvedValueOnce(pedido);
    paymentClienteMock.create.mockResolvedValueOnce({
      id: 2,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 500,
      payment_method_id: 'visa',
    });
    paymentClienteMock.get.mockResolvedValueOnce({
      status: 'approved',
      external_reference: 'FJ-0001',
    });

    await service.procesar('usuario-1', crearDto({ token: 'tok_aprobado' }));
    expect(paymentClienteMock.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requestOptions: { idempotencyKey: 'pedido-1:tok_aprobado' },
      }),
    );
  });
});

describe('PaymentsService.crearPreferencia', () => {
  let service: PaymentsService;
  let pedidos: jest.Mocked<Pick<Repository<Pedido>, 'findOne' | 'update'>>;

  function crearPedidoConItems(): Pedido {
    return {
      id: 'pedido-1',
      usuarioId: 'usuario-1',
      numeroPedido: 'FJ-0001',
      total: 500,
      costoEnvio: 50,
      estadoPago: EstadoPago.PENDIENTE,
      items: [
        {
          productoId: 'producto-1',
          cantidad: 1,
          precioUnitario: 450,
          producto: { nombre: 'Jeans clásico' },
        },
      ],
    } as unknown as Pedido;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    pedidos = { findOne: jest.fn(), update: jest.fn() };
    const usuarios = {
      findOne: jest.fn().mockResolvedValue({ nombre: 'Compradora', email: 'c@test.com' }),
    } as unknown as Repository<Usuario>;
    const config = { get: jest.fn(() => 'valor-de-prueba') } as unknown as ConfigService;

    service = new PaymentsService(
      pedidos as unknown as Repository<Pedido>,
      usuarios,
      config,
    );
  });

  it('responde con un error controlado (no un 500 crudo) cuando Mercado Pago falla al crear la preferencia', async () => {
    pedidos.findOne.mockResolvedValueOnce(crearPedidoConItems());
    preferenceClienteMock.create.mockRejectedValueOnce({
      message: 'Service unavailable',
      status: 503,
    });

    const dto: CrearPreferenciaDto = { pedidoId: 'pedido-1' };
    await expect(service.crearPreferencia('usuario-1', dto)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('sigue devolviendo la preferencia normalmente cuando Mercado Pago responde bien (sin regresión)', async () => {
    pedidos.findOne.mockResolvedValueOnce(crearPedidoConItems());
    preferenceClienteMock.create.mockResolvedValueOnce({ id: 'pref-123' });

    const dto: CrearPreferenciaDto = { pedidoId: 'pedido-1' };
    const resultado = await service.crearPreferencia('usuario-1', dto);

    expect(resultado).toEqual({ preferenceId: 'pref-123', amount: 500 });
  });
});
