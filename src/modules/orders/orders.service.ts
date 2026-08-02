import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  Direccion,
  EstadoPago,
  EstadoPedido,
  ItemPedido,
  Pedido,
  Producto,
  RolUsuario,
} from '../../entities';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { OffersService } from '../offers/offers.service';
import { ShippingService } from '../shipping/shipping.service';
import { CrearPedidoDto } from './dto/crear-pedido.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Pedido) private readonly pedidos: Repository<Pedido>,
    @InjectRepository(Direccion)
    private readonly direcciones: Repository<Direccion>,
    @InjectRepository(Producto)
    private readonly productos: Repository<Producto>,
    private readonly offersService: OffersService,
    private readonly shippingService: ShippingService,
    private readonly dataSource: DataSource,
  ) {}

  async crear(usuarioId: string, dto: CrearPedidoDto): Promise<Pedido> {
    const direccion = await this.direcciones.findOne({
      where: { id: dto.direccionId, usuarioId },
    });
    if (!direccion) {
      throw new NotFoundException('Dirección no encontrada.');
    }

    const productoIds = [...new Set(dto.items.map((item) => item.productoId))];
    const productosEncontrados = await this.productos.find({
      where: { id: In(productoIds) },
      relations: { tallasDisponibles: true, coloresDisponibles: true },
    });
    const productosPorId = new Map(
      productosEncontrados.map((producto) => [producto.id, producto]),
    );

    if (productosPorId.size !== productoIds.length) {
      throw new BadRequestException(
        'Uno o más productos del pedido ya no existen.',
      );
    }

    // Talla/color: única validación de "disponibilidad" posible hoy — el modelo
    // actual no tiene control de stock por unidad. Si un producto no tiene esa
    // talla/color en su catálogo (o el catálogo la desactivó desde que se
    // armó el carrito), la línea se rechaza.
    for (const item of dto.items) {
      const producto = productosPorId.get(item.productoId)!;
      const tallaValida = producto.tallasDisponibles.some(
        (talla) => talla.nombre === item.talla && talla.activo,
      );
      const colorValido = producto.coloresDisponibles.some(
        (color) => color.nombre === item.color && color.activo,
      );
      if (!tallaValida) {
        throw new BadRequestException(
          `"${producto.nombre}" no está disponible en talla ${item.talla}.`,
        );
      }
      if (!colorValido) {
        throw new BadRequestException(
          `"${producto.nombre}" no está disponible en color ${item.color}.`,
        );
      }
    }

    // Precio: SIEMPRE recalculado aquí, nunca tomado del body (el DTO ni siquiera
    // tiene un campo de precio). Se consulta el Producto actual en BD y se le
    // aplica la oferta vigente — así nadie puede comprar a precio inventado ni
    // a precio base ignorando un descuento activo.
    const ofertasVigentes = await this.offersService.obtenerOfertasVigentes();
    const lineas = dto.items.map((item) => {
      const producto = productosPorId.get(item.productoId)!;
      const precio = this.offersService.calcularPrecioConOfertas(
        producto,
        ofertasVigentes,
      );
      return { item, producto, precioUnitario: precio.precioFinal };
    });

    const subtotal =
      Math.round(
        lineas.reduce(
          (total, linea) => total + linea.precioUnitario * linea.item.cantidad,
          0,
        ) * 100,
      ) / 100;

    // Envío: SIEMPRE revalidado contra Skydropx/caché, nunca un costoEnvio suelto
    // en el body — el DTO tampoco tiene ese campo, solo las referencias a cotizar de nuevo.
    const opcionEnvio = await this.shippingService.revalidar(
      dto.cotizacionId,
      dto.rateId,
    );
    if (!opcionEnvio) {
      throw new BadRequestException(
        'La cotización de envío expiró o ya no es válida. Cotiza de nuevo.',
      );
    }

    const costoEnvio = opcionEnvio.costo;
    const total = Math.round((subtotal + costoEnvio) * 100) / 100;

    const nuevoPedido = this.pedidos.create({
      numeroPedido: await this.generarNumeroPedidoUnico(),
      usuarioId,
      subtotal,
      costoEnvio,
      total,
      datosEnvio: {
        nombreCompleto: direccion.nombreCompleto,
        direccion: direccion.direccion,
        ciudad: direccion.ciudad,
        codigoPostal: direccion.codigoPostal,
        telefono: direccion.telefono,
      },
      metodoPago: dto.metodoPago,
      estado: EstadoPedido.PENDIENTE,
      estadoPago: EstadoPago.PENDIENTE,
      infoEnvio: {
        paqueteria: null,
        idEnvioSkydropx: null,
        numeroGuia: null,
        urlEtiqueta: null,
        urlRastreo: null,
        fechaEnvio: null,
      },
      datosFiscales: {
        rfc: dto.datosFiscales?.rfc ?? null,
        razonSocial: dto.datosFiscales?.razonSocial ?? null,
        regimenFiscal: dto.datosFiscales?.regimenFiscal ?? null,
      },
      items: lineas.map((linea) =>
        this.dataSource.getRepository(ItemPedido).create({
          productoId: linea.producto.id,
          talla: linea.item.talla,
          color: linea.item.color,
          cantidad: linea.item.cantidad,
          precioUnitario: linea.precioUnitario,
        }),
      ),
    });

    // cascade: true en Pedido.items hace que items se inserten en la misma
    // transacción implícita del save() — pedido y líneas quedan o no quedan juntos.
    return this.pedidos.save(nuevoPedido);
  }

  listarDelUsuario(usuarioId: string): Promise<Pedido[]> {
    return this.pedidos.find({
      where: { usuarioId },
      relations: { items: { producto: true } },
      order: { fecha: 'DESC' },
    });
  }

  async obtenerUnoDelUsuario(id: string, usuarioId: string): Promise<Pedido> {
    // Mismo patrón que Direcciones/Favoritos: where: { id, usuarioId } en una sola
    // consulta, nunca "buscar y luego comparar dueño" — el pedido de otro usuario
    // da 404, indistinguible de uno que no existe (mitiga IDOR).
    const pedido = await this.pedidos.findOne({
      where: { id, usuarioId },
      relations: { items: { producto: true } },
    });

    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    return pedido;
  }

  /**
   * GET /pedidos/:id/rastreo — respaldo bajo demanda además del webhook de
   * Skydropx (ver ShippingController.webhook): el vendedor ve cualquier
   * pedido, el comprador solo el suyo (mismo criterio anti-IDOR que el resto
   * de este servicio). Si el pedido no tiene guía generada todavía, o
   * Skydropx no responde, se devuelve el trackingStatus que ya hubiera en BD
   * (o null) en vez de fallar.
   */
  async obtenerRastreo(
    id: string,
    usuario: AuthenticatedUser,
  ): Promise<{ trackingStatus: string | null }> {
    const pedido = await this.pedidos.findOne({
      where:
        usuario.rol === RolUsuario.VENDEDOR ? { id } : { id, usuarioId: usuario.id },
    });
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    if (!pedido.infoEnvio.idEnvioSkydropx) {
      return { trackingStatus: pedido.infoEnvio.trackingStatus };
    }

    const estadoActual = await this.shippingService.consultarRastreo(
      pedido.infoEnvio.idEnvioSkydropx,
    );
    if (estadoActual && estadoActual !== pedido.infoEnvio.trackingStatus) {
      await this.pedidos.update(
        { id },
        { infoEnvio: { ...pedido.infoEnvio, trackingStatus: estadoActual } },
      );
    }

    return { trackingStatus: estadoActual ?? pedido.infoEnvio.trackingStatus };
  }

  private async generarNumeroPedidoUnico(): Promise<string> {
    for (let intento = 0; intento < 5; intento += 1) {
      const candidato = `PED-${randomUUID().slice(0, 8).toUpperCase()}`;
      const existente = await this.pedidos.findOne({
        where: { numeroPedido: candidato },
      });
      if (!existente) {
        return candidato;
      }
    }
    // Con UUID de 8 hex chars la probabilidad real de 5 colisiones seguidas es
    // astronómicamente baja; si pasa, algo más está mal y es mejor fallar fuerte.
    throw new BadRequestException(
      'No se pudo generar un número de pedido único. Intenta de nuevo.',
    );
  }
}
