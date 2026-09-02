import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { MenuService } from "../menu/menu.service";
import { createAggregatorAdapter } from "@kaana/integrations";
import { EventsGateway } from "../events/events.gateway";

@Injectable()
export class PartnerService {
  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private menuService: MenuService,
    private events: EventsGateway,
  ) {}

  async fetchMenu(restId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { code: restId, isActive: true },
    });
    if (!outlet) throw new Error("Restaurant not found");

    const menus = await this.menuService.getOutletMenu(outlet.id);
    return { restId, outletId: outlet.id, menus };
  }

  async saveOrder(data: {
    restId: string;
    externalOrderId: string;
    source: "swiggy" | "zomato" | "website";
    items: Array<{ itemId: string; name: string; quantity: number; unitPrice: number; notes?: string }>;
    customer?: { name?: string; phone?: string };
    type?: "delivery" | "takeaway";
  }) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { code: data.restId, isActive: true },
    });
    if (!outlet) throw new Error("Restaurant not found");

    const existing = await this.prisma.order.findFirst({
      where: { outletId: outlet.id, externalOrderId: data.externalOrderId },
    });
    if (existing) return existing;

    const order = await this.ordersService.create({
      outletId: outlet.id,
      source: data.source,
      type: data.type ?? "delivery",
      notes: data.customer?.name ? `Customer: ${data.customer.name}` : undefined,
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { externalOrderId: data.externalOrderId, aggregatorData: data as never },
    });

    for (const item of data.items) {
      await this.ordersService.addItem(order.id, {
        menuItemId: item.itemId,
        quantity: item.quantity,
        notes: item.notes,
      });
    }

    await this.ordersService.fireKOT(order.id);

    const adapter = createAggregatorAdapter(data.source);
    await adapter.acknowledgeOrder(data.externalOrderId, "accepted");

    this.events.emitOrderUpdate(outlet.id, {
      type: "aggregator_order",
      orderId: order.id,
      id: order.id,
      source: data.source,
      externalOrderId: data.externalOrderId,
    });
    return this.ordersService.findOne(order.id);
  }

  async pushStock(restId: string, items: Array<{ itemId: string; isAvailable: boolean }>) {
    const outlet = await this.prisma.outlet.findFirst({ where: { code: restId } });
    if (!outlet) throw new Error("Restaurant not found");

    for (const item of items) {
      await this.menuService.updateAvailability(outlet.id, item.itemId, item.isAvailable);
    }

    const creds = await this.prisma.integrationCredential.findMany({
      where: { outletId: outlet.id, isActive: true },
    });

    for (const cred of creds) {
      const adapter = createAggregatorAdapter(cred.type);
      for (const item of items) {
        await adapter.updateItemAvailability(outlet.id, item.itemId, item.isAvailable);
      }
    }

    return { success: true, updated: items.length };
  }

  async simulateOrder(outletId: string, source: "swiggy" | "zomato") {
    const menu = await this.menuService.getOutletMenu(outletId);
    const firstItem = menu[0]?.categories[0]?.items[0];
    if (!firstItem) throw new Error("No menu items");

    const outlet = await this.prisma.outlet.findUniqueOrThrow({ where: { id: outletId } });

    return this.saveOrder({
      restId: outlet.code,
      externalOrderId: `${source.toUpperCase()}-${Date.now()}`,
      source,
      items: [{ itemId: firstItem.id, name: firstItem.name, quantity: 1, unitPrice: Number(firstItem.price) }],
      customer: { name: "Test Customer", phone: "+919999999999" },
      type: "delivery",
    });
  }
}
