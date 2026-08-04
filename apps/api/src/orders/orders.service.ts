import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { InventoryService } from "../inventory/inventory.service";
import { AuditService } from "../audit/audit.service";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private inventory: InventoryService,
    private audit: AuditService,
  ) {}

  private async nextOrderNumber(outletId: string): Promise<string> {
    const count = await this.prisma.order.count({ where: { outletId } });
    return `ORD-${String(count + 1).padStart(5, "0")}`;
  }

  async create(data: {
    outletId: string; terminalId?: string; tableId?: string; customerId?: string;
    type?: string; source?: string; guestCount?: number; notes?: string; createdById?: string;
  }) {
    const orderNumber = await this.nextOrderNumber(data.outletId);

    const order = await this.prisma.order.create({
      data: {
        outletId: data.outletId,
        terminalId: data.terminalId,
        tableId: data.tableId,
        customerId: data.customerId,
        createdById: data.createdById,
        orderNumber,
        type: (data.type ?? "dine_in") as never,
        source: (data.source ?? "dine_in") as never,
        guestCount: data.guestCount ?? 1,
        notes: data.notes,
        status: "open",
      },
      include: { items: true, table: true },
    });

    if (data.tableId) {
      await this.prisma.table.update({
        where: { id: data.tableId },
        data: { status: "seated" },
      });
    }

    this.events.emitOrderUpdate(data.outletId, order);
    return order;
  }

  async addItem(orderId: string, data: {
    menuItemId: string; variantId?: string; quantity?: number; notes?: string; addons?: unknown[];
  }) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });

    if (!["draft", "open"].includes(order.status)) {
      throw new BadRequestException("Cannot modify order in current status");
    }

    const menuItem = await this.prisma.menuItem.findUniqueOrThrow({
      where: { id: data.menuItemId },
      include: { taxRule: true, variants: true },
    });

    const variant = data.variantId
      ? menuItem.variants.find((v) => v.id === data.variantId)
      : null;

    const unitPrice = Number(menuItem.basePrice) + Number(variant?.priceDelta ?? 0);
    const quantity = data.quantity ?? 1;
    const lineTotal = unitPrice * quantity;
    const taxRate = menuItem.taxRule
      ? Number(menuItem.taxRule.cgstRate) + Number(menuItem.taxRule.sgstRate)
      : 0;
    const taxAmount = (lineTotal * taxRate) / 100;

    const item = await this.prisma.orderItem.create({
      data: {
        orderId,
        menuItemId: data.menuItemId,
        variantId: data.variantId,
        name: variant ? `${menuItem.name} (${variant.name})` : menuItem.name,
        quantity,
        unitPrice,
        taxAmount,
        totalPrice: lineTotal + taxAmount,
        notes: data.notes,
        addons: (data.addons ?? []) as never,
      },
    });

    await this.recalculateOrder(orderId);
    const updated = await this.findOne(orderId);
    this.events.emitOrderUpdate(order.outletId, updated);
    return item;
  }

  async fireKOT(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: { where: { kotId: null }, include: { menuItem: { include: { kitchenStation: true } } } },
      },
    });

    const itemsByStation = new Map<string, typeof order.items>();
    for (const item of order.items) {
      const stationId = item.menuItem.kitchenStationId;
      if (!stationId) continue;
      if (!itemsByStation.has(stationId)) itemsByStation.set(stationId, []);
      itemsByStation.get(stationId)!.push(item);
    }

    const kots: Awaited<ReturnType<typeof this.prisma.kOT.create>>[] = [];
    for (const [stationId, items] of itemsByStation) {
      const kotCount = await this.prisma.kOT.count({ where: { order: { outletId: order.outletId } } });
      const kot = await this.prisma.kOT.create({
        data: {
          orderId,
          kitchenStationId: stationId,
          kotNumber: `KOT-${String(kotCount + 1).padStart(4, "0")}`,
          status: "pending",
          items: {
            create: items.map((item) => ({
              orderItemId: item.id,
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true, kitchenStation: true },
      });

      await this.prisma.orderItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { kotId: kot.id, status: "kot_fired" },
      });

      kots.push(kot);
      this.events.emitKOTUpdate(stationId, kot);

      for (const item of items) {
        await this.inventory.deductForSale(order.outletId, item.menuItemId, item.quantity);
      }
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: "kot_fired" },
    });

    return kots;
  }

  async settle(orderId: string, data: {
    payments: Array<{ method: string; amount: number; reference?: string }>;
    discountAmount?: number; loyaltyPointsUsed?: number; customerPhone?: string;
  }) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, outlet: true },
    });

    const discount = data.discountAmount ?? 0;
    const totalPaid = data.payments.reduce((s, p) => s + p.amount, 0);

    if (totalPaid < Number(order.totalAmount) - discount) {
      throw new BadRequestException("Insufficient payment amount");
    }

    await this.prisma.payment.createMany({
      data: data.payments.map((p) => ({
        orderId,
        method: p.method as never,
        amount: p.amount,
        status: "completed",
        reference: p.reference,
        processedAt: new Date(),
      })),
    });

    const invoice = await this.generateInvoice(order, discount);

    if (data.customerPhone) {
      await this.upsertCustomer(order.outletId, data.customerPhone, Number(order.totalAmount) - discount);
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: "settled", discountAmount: discount, settledAt: new Date() },
    });

    if (order.tableId) {
      await this.prisma.table.update({
        where: { id: order.tableId },
        data: { status: "free" },
      });
    }

    const settled = await this.findOne(orderId);
    this.events.emitOrderUpdate(order.outletId, settled);

    const org = await this.prisma.outlet.findUnique({ where: { id: order.outletId }, select: { brand: { select: { organizationId: true } } } });
    if (org) {
      await this.audit.log({
        organizationId: org.brand.organizationId,
        outletId: order.outletId,
        action: discount > 0 ? "discount_applied" : "bill_modified",
        entityType: "order",
        entityId: orderId,
        metadata: { discount, totalPaid, invoiceNumber: invoice.invoiceNumber },
      });
    }

    return { order: settled, invoice };
  }

  private async generateInvoice(order: { id: string; outletId: string; subtotal: Decimal; taxAmount: Decimal; totalAmount: Decimal; outlet: { gstin: string | null } }, discount: number) {
    const year = new Date().getFullYear();
    const seq = await this.prisma.invoiceSequence.upsert({
      where: { outletId_year: { outletId: order.outletId, year } },
      update: { lastNumber: { increment: 1 } },
      create: { outletId: order.outletId, year, lastNumber: 1 },
    });

    const taxableAmount = Number(order.subtotal) - discount;
    const taxAmount = Number(order.taxAmount);

    return this.prisma.invoice.create({
      data: {
        orderId: order.id,
        invoiceNumber: `${seq.prefix}-${year}-${String(seq.lastNumber).padStart(5, "0")}`,
        gstin: order.outlet.gstin,
        taxableAmount,
        cgstAmount: taxAmount / 2,
        sgstAmount: taxAmount / 2,
        totalAmount: taxableAmount + taxAmount,
      },
    });
  }

  private async upsertCustomer(outletId: string, phone: string, amount: number) {
    await this.prisma.customer.upsert({
      where: { outletId_phone: { outletId, phone } },
      update: { totalOrders: { increment: 1 }, totalSpent: { increment: amount } },
      create: { outletId, phone, totalOrders: 1, totalSpent: amount },
    });
  }

  private async recalculateOrder(orderId: string) {
    const items = await this.prisma.orderItem.findMany({ where: { orderId } });
    const subtotal = items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
    const taxAmount = items.reduce((s, i) => s + Number(i.taxAmount), 0);
    const totalAmount = items.reduce((s, i) => s + Number(i.totalPrice), 0);

    return this.prisma.order.update({
      where: { id: orderId },
      data: { subtotal, taxAmount, totalAmount },
    });
  }

  findByOutlet(outletId: string, status?: string) {
    return this.prisma.order.findMany({
      where: { outletId, ...(status ? { status: status as never } : {}) },
      include: { items: true, table: true, payments: true, invoice: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  findOne(id: string) {
    return this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        payments: true,
        invoice: true,
        kots: { include: { kitchenStation: true, items: true } },
        customer: true,
      },
    });
  }

  async splitTable(sourceOrderId: string, itemIds: string[], targetTableId: string) {
    const source = await this.findOne(sourceOrderId);
    const newOrder = await this.create({
      outletId: source.outletId,
      tableId: targetTableId,
      terminalId: source.terminalId ?? undefined,
      type: source.type,
    });

    await this.prisma.orderItem.updateMany({
      where: { id: { in: itemIds } },
      data: { orderId: newOrder.id },
    });

    await this.recalculateOrder(sourceOrderId);
    await this.recalculateOrder(newOrder.id);
    return this.findOne(newOrder.id);
  }

  getUnifiedInbox(outletId: string) {
    return this.prisma.order.findMany({
      where: {
        outletId,
        source: { in: ["swiggy", "zomato", "website", "phone"] },
        status: { in: ["open", "kot_fired", "preparing"] },
      },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    });
  }
}
