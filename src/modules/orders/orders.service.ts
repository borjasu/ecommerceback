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
import {
  agruparCantidadesPorProducto,
  resolverPrecioUnitario,
} from './mayoreo-precio.util';

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

    // Mayoreo (por producto, un solo nivel — ver entities/producto.entity.ts):
    // el mínimo se evalúa sumando TODAS las tallas/colores de un mismo
    // producto en este pedido, nunca por línea individual, así que hay que
    // agrupar por productoId ANTES de fijar precioUnitario. Se calcula aquí
    // (a partir de las cantidades reales que el propio comprador está
    // pidiendo) y nunca a partir de nada que mande el frontend: no hay forma
    // de manipular esto vía HTTP directo sin de verdad pedir esa cantidad
    // (ver mayoreo-precio.util.ts y su spec para el detalle y las pruebas).
    const cantidadPorProducto = agruparCantidadesPorProducto(dto.items);

    const lineas = dto.items.map((item) => {
      const producto = productosPorId.get(item.productoId)!;
      const precioConOferta = this.offersService.calcularPrecioConOfertas(
        producto,
        ofertasVigentes,
      ).precioFinal;
      const precioUnitario = resolverPrecioUnitario(
        producto,
        cantidadPorProducto.get(item.productoId)!,
        precioConOferta,
      );

      return { item, producto, precioUnitario };
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
        // direccion/ciudad: calculados a partir de los campos estructurados
        // de abajo, no capturados aparte — se conservan solo porque
        // vendedor/pedidos y mis-pedidos (comprador) ya los leen tal cual
        // (ver DatosEnvio.embeddable.ts).
        direccion: this.formatearDireccionLegacy(direccion),
        ciudad: direccion.municipio,
        calle: direccion.calle,
        numeroExterior: direccion.numeroExterior,
        numeroInterior: direccion.numeroInterior,
        colonia: direccion.colonia,
        municipio: direccion.municipio,
        estado: direccion.estado,
        referencias: direccion.referencias,
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
      // imagenesColores: mismo patrón que products.service.ts — sin esto,
      // mis-pedidos.component.ts (frontend) solo tenía item.producto.imagenUrl
      // y caía al placeholder genérico para productos sin imagen general.
      relations: { items: { producto: { imagenesColores: true } } },
      order: { fecha: 'DESC' },
    });
  }

  async obtenerUnoDelUsuario(id: string, usuarioId: string): Promise<Pedido> {
    // Mismo patrón que Direcciones/Favoritos: where: { id, usuarioId } en una sola
    // consulta, nunca "buscar y luego comparar dueño" — el pedido de otro usuario
    // da 404, indistinguible de uno que no existe (mitiga IDOR).
    const pedido = await this.pedidos.findOne({
      where: { id, usuarioId },
      relations: { items: { producto: { imagenesColores: true } } },
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
        usuario.rol === RolUsuario.VENDEDOR
          ? { id }
          : { id, usuarioId: usuario.id },
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

  // Compat: vendedor/pedidos y mis-pedidos (comprador) del frontend siguen
  // mostrando una sola línea de calle — se arma aquí en vez de agregarles el
  // desglose estructurado, para no tocar esas dos vistas ya funcionando.
  private formatearDireccionLegacy(direccion: Direccion): string {
    const interior = direccion.numeroInterior
      ? ` Int. ${direccion.numeroInterior}`
      : '';
    return `${direccion.calle} ${direccion.numeroExterior}${interior}, Col. ${direccion.colonia}`;
  }
}
