import { ValidationPipe } from '@nestjs/common';
import { CrearPedidoDto } from './dto/crear-pedido.dto';

/**
 * Prueba de seguridad (punto 6 del prompt de mayoreo): confirma, contra el
 * MISMO ValidationPipe global que registra main.ts (whitelist + forbidNonWhitelisted),
 * que un intento de mandar un precio o una bandera de "usar mayoreo" en el
 * body de POST /pedidos se rechaza ANTES de que OrdersService.crear() se
 * ejecute siquiera — nunca llega a evaluarse ningún precio que venga del
 * cliente. Esto es lo que hace posible que el mayoreo sea 100% autoritativo
 * del lado servidor (ver mayoreo-precio.util.ts/.spec.ts para el cálculo en
 * sí, a partir de cantidades reales).
 */
describe('CrearPedidoDto + ValidationPipe global (anti-manipulación de precio)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  const metadata = {
    type: 'body' as const,
    metatype: CrearPedidoDto,
  };

  const payloadValido = {
    items: [
      {
        productoId: '11111111-1111-4111-8111-111111111111',
        talla: 'M',
        color: 'Rojo',
        cantidad: 2,
      },
    ],
    direccionId: '22222222-2222-4222-8222-222222222222',
    cotizacionId: 'cot-1',
    rateId: 'rate-1',
    metodoPago: 'tarjeta',
  };

  it('acepta un pedido válido sin ningún campo de precio', async () => {
    await expect(pipe.transform({ ...payloadValido }, metadata)).resolves.toBeDefined();
  });

  it('rechaza si el cliente manda un precioUnitario en el item, intentando forzar el precio de mayoreo', async () => {
    const payload = {
      ...payloadValido,
      items: [{ ...payloadValido.items[0], precioUnitario: 1 }],
    };

    await expect(pipe.transform(payload, metadata)).rejects.toThrow();
  });

  it('rechaza si el cliente manda una bandera para forzar mayoreo directamente', async () => {
    const payload = { ...payloadValido, usarPrecioMayoreo: true };

    await expect(pipe.transform(payload, metadata)).rejects.toThrow();
  });

  it('rechaza si el cliente manda un total/subtotal propio en el body', async () => {
    const payload = { ...payloadValido, total: 1, subtotal: 1 };

    await expect(pipe.transform(payload, metadata)).rejects.toThrow();
  });
});
