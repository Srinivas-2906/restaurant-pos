import { Injectable, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { InventoryService } from "../inventory/inventory.service";
import { AuditService } from "../audit/audit.service";
import { PrintBridgeService } from "../print/print-bridge.service";
import { createAggregatorAdapter } from "@kaana/integrations";
import {
  ACTION_PERMISSIONS,
  getOutletBillingMode,
  hasActionPermission,
  inferFulfilment,
  type FulfilmentType,
  type OrderSource,
  type OrderType,
} from "@kaana/shared-types";
import { Decimal } from "@prisma/client/runtime/library";

const ACTIVE_ORDER_STATUSES = [
  "draft", "open", "kot_fired", "preparing", "ready", "served", "billed",
] as const;

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private inventory: InventoryService,
    private audit: AuditService,
    private printBridge: PrintBridgeService,
  ) {}

  private async nextOrderNumber(outletId: string): Promise<string> {
    const count = await this.prisma.order.count({ where: { outletId } });
    return `ORD-${String(count + 1).padStart(5, "0")}`;
  }

  async create(data: {
    outletId: string; terminalId?: string; tableId?: string; customerId?: string;
    type?: string; source?: string; fulfilment?: string; guestCount?: number; notes?: string;
    createdById?: string; reservationId?: string; actorRole?: string;
  }) {
    const orderType = (data.type ?? "dine_in") as OrderType;
    let source = (data.source ?? "dine_in") as OrderSource;
    if (data.actorRole === "captain" && !data.source) {
      source = "captain";
    }
    if (data.actorRole === "biller" && !data.source) {
      source = "pos";
    }
    const fulfilment = (data.fulfilment as FulfilmentType | undefined) ??
      inferFulfilment(orderType, source);

    const orderNumber = await this.nextOrderNumber(data.outletId);

    const order = await this.prisma.order.create({
      data: {
        outletId: data.outletId,
        terminalId: data.terminalId,
        tableId: data.tableId,
        customerId: data.customerId,
        reservationId: data.reservationId,
        createdById: data.createdById,
        orderNumber,
        type: orderType as never,
        source: source as never,
        fulfilment: fulfilment as never,
        guestCount: data.guestCount ?? 1,
        notes: data.notes,
        status: "open",
      },
      include: { items: true, table: true, createdBy: { select: { id: true, firstName: true, lastName: true } } },
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

  async createFromReservation(data: {
    outletId: string; tableId: string; customerId?: string; reservationId: string;
    guestCount: number; notes?: string; terminalId?: string; createdById?: string;
  }) {
    return this.create({
      outletId: data.outletId,
      tableId: data.tableId,
      customerId: data.customerId,
      reservationId: data.reservationId,
      guestCount: data.guestCount,
      notes: data.notes,
      terminalId: data.terminalId,
      createdById: data.createdById,
      type: "dine_in",
      source: "dine_in",
    });
  }

  async addItem(orderId: string, data: {
    menuItemId: string; variantId?: string; quantity?: number; notes?: string; addons?: unknown[];
  }) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true },
    });

    if (!["draft", "open", "kot_fired", "preparing", "ready", "served", "billed"].includes(order.status)) {
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
    const taxRate = menuItem.taxRule
      ? Number(menuItem.taxRule.cgstRate) + Number(menuItem.taxRule.sgstRate)
      : 0;

    const existing = order.items.find(
      (i) =>
        i.menuItemId === data.menuItemId &&
        (i.variantId ?? null) === (data.variantId ?? null) &&
        !i.kotId &&
        i.status === "pending",
    );

    if (existing) {
      return this.updateItemQuantity(orderId, existing.id, existing.quantity + quantity);
    }

    const lineTotal = unitPrice * quantity;
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

    if (["kot_fired", "billed", "served"].includes(order.status)) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: "open" } });
      if (order.tableId) {
        await this.prisma.table.update({ where: { id: order.tableId }, data: { status: "seated" } });
      }
    }

    await this.recalculateOrder(orderId);
    const updated = await this.findOne(orderId);
    this.events.emitOrderUpdate(order.outletId, updated);
    return item;
  }

  async updateItemQuantity(orderId: string, itemId: string, quantity: number) {
    if (quantity < 1) {
      return this.removeItem(orderId, itemId);
    }

    const item = await this.prisma.orderItem.findFirstOrThrow({
      where: { id: itemId, orderId },
      include: { menuItem: { include: { taxRule: true } } },
    });

    if (item.kotId || item.status !== "pending") {
      throw new BadRequestException("Cannot change quantity after KOT is fired");
    }

    const lineTotal = Number(item.unitPrice) * quantity;
    const taxRate = item.menuItem.taxRule
      ? Number(item.menuItem.taxRule.cgstRate) + Number(item.menuItem.taxRule.sgstRate)
      : 0;
    const taxAmount = (lineTotal * taxRate) / 100;

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: {
        quantity,
        taxAmount,
        totalPrice: lineTotal + taxAmount,
      },
    });

    await this.recalculateOrder(orderId);
    const order = await this.findOne(orderId);
    this.events.emitOrderUpdate(order.outletId, order);
    return order;
  }

  async removeItem(orderId: string, itemId: string, options?: { asWastage?: boolean }) {
    const item = await this.prisma.orderItem.findFirstOrThrow({
      where: { id: itemId, orderId },
      include: { order: true },
    });

    if (item.kotId || item.status !== "pending") {
      if (!item.kotId) {
        throw new BadRequestException("Cannot remove item after KOT is fired");
      }
      await this.inventory.releaseCommit(item.order.outletId, itemId, options?.asWastage ?? true);
    }

    await this.prisma.orderItem.delete({ where: { id: itemId } });
    await this.recalculateOrder(orderId);
    const order = await this.findOne(orderId);
    this.events.emitOrderUpdate(order.outletId, order);
    return order;
  }

  getOpenOrderForTable(outletId: string, tableId: string) {
    return this.prisma.order.findFirst({
      where: {
        outletId,
        tableId,
        status: { in: [...ACTIVE_ORDER_STATUSES] },
      },
      include: {
        items: { include: { menuItem: true }, orderBy: { id: "asc" } },
        table: true,
        kots: { include: { kitchenStation: true }, orderBy: { firedAt: "asc" } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async fireKOT(orderId: string, userId?: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: { where: { kotId: null }, include: { menuItem: { include: { kitchenStation: true } } } },
        table: true,
      },
    });

    const pendingItems = order.items.filter((i) => !i.kotId && i.status === "pending");
    const unassigned = pendingItems.filter((i) => !i.menuItem.kitchenStationId);
    if (unassigned.length > 0) {
      throw new BadRequestException(
        `Cannot fire KOT: items missing kitchen station — ${unassigned.map((i) => i.name).join(", ")}`,
      );
    }

    const itemsByStation = new Map<string, typeof pendingItems>();
    for (const item of pendingItems) {
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
        include: { items: { include: { orderItem: true } }, kitchenStation: true },
      });

      await this.prisma.orderItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { kotId: kot.id, status: "kot_fired" },
      });

      kots.push(kot);
      this.events.emitKOTUpdate(stationId, kot);

      const org = await this.prisma.outlet.findUnique({
        where: { id: order.outletId },
        select: { brand: { select: { organizationId: true } } },
      });
      if (org) {
        await this.audit.log({
          organizationId: org.brand.organizationId,
          userId,
          outletId: order.outletId,
          action: "kot_fired",
          entityType: "order",
          entityId: orderId,
          metadata: {
            kotId: kot.id,
            kotNumber: kot.kotNumber,
            stationName: kot.kitchenStation.name,
            tableNumber: order.table?.number ?? null,
            itemNames: items.map((i) => i.name),
          },
        });
      }
    }

    if (kots.length === 0) {
      const skipped = pendingItems.filter((i) => !i.menuItem.kitchenStationId);
      if (skipped.length > 0) {
        throw new BadRequestException(
          `Cannot fire KOT: items missing kitchen station — ${skipped.map((i) => i.name).join(", ")}`,
        );
      }
      throw new BadRequestException("No pending items to fire to kitchen");
    }

    const hasUnfired = await this.prisma.orderItem.count({
      where: { orderId, kotId: null, status: "pending" },
    });

    const nextStatus = hasUnfired > 0 ? "open" : "kot_fired";
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: nextStatus },
    });

    const allItems = await this.prisma.orderItem.findMany({ where: { orderId } });
    const firedItems = allItems.filter((i) => i.kotId);
    const inKitchenCount = firedItems.filter((i) => i.status === "kot_fired").length;

    this.events.emitOrderUpdate(order.outletId, {
      type: "kot_fired",
      orderId,
      tableId: order.tableId,
      kotNumbers: kots.map((k) => k.kotNumber),
      inKitchenCount,
      readyCount: 0,
      orderStatus: nextStatus,
    });

    const firedOrderItems = await this.prisma.orderItem.findMany({
      where: { orderId, kotId: { not: null }, id: { in: pendingItems.map((i) => i.id) } },
    });
    await this.inventory.commitStockForOrder(
      order.outletId,
      orderId,
      firedOrderItems.map((i) => ({ id: i.id, menuItemId: i.menuItemId, quantity: i.quantity })),
    );

    return kots;
  }

  async markItemServed(orderId: string, itemId: string, userId?: string) {
    const item = await this.prisma.orderItem.findFirstOrThrow({
      where: { id: itemId, orderId },
      include: { order: { include: { table: true } } },
    });

    if (item.status !== "ready") {
      throw new BadRequestException("Only ready items can be marked as served");
    }

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { status: "served" },
    });

    if (item.kotId) {
      await this.prisma.kOTItem.updateMany({
        where: { kotId: item.kotId, orderItemId: itemId },
        data: { status: "served" },
      });

      const kotItems = await this.prisma.kOTItem.findMany({ where: { kotId: item.kotId } });
      if (kotItems.length > 0 && kotItems.every((ki) => ki.status === "served")) {
        await this.prisma.kOT.update({
          where: { id: item.kotId },
          data: { status: "served" },
        });
      }
    }

    const order = item.order;
    const items = await this.prisma.orderItem.findMany({ where: { orderId } });
    const firedItems = items.filter((i) => i.kotId);
    const pendingUnfired = items.filter((i) => !i.kotId).length;
    const inKitchenCount = firedItems.filter((i) => i.status === "kot_fired" || i.status === "preparing").length;
    const readyCount = firedItems.filter((i) => i.status === "ready").length;
    const servedCount = firedItems.filter((i) => i.status === "served").length;

    let orderStatus: string;
    if (pendingUnfired > 0) {
      orderStatus = inKitchenCount > 0 || readyCount > 0 || servedCount > 0 ? "preparing" : "open";
    } else if (firedItems.length > 0 && servedCount === firedItems.length) {
      orderStatus = "served";
    } else if (firedItems.length > 0 && readyCount + servedCount === firedItems.length) {
      orderStatus = "ready";
    } else if (inKitchenCount > 0) {
      orderStatus = "preparing";
    } else {
      orderStatus = "kot_fired";
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: orderStatus as never },
    });

    const org = await this.prisma.outlet.findUnique({
      where: { id: order.outletId },
      select: { brand: { select: { organizationId: true } } },
    });

    if (org) {
      await this.audit.log({
        organizationId: org.brand.organizationId,
        userId,
        outletId: order.outletId,
        action: "item_served",
        entityType: "order",
        entityId: orderId,
        metadata: {
          itemId,
          itemName: item.name,
          quantity: item.quantity,
          tableNumber: order.table?.number ?? null,
        },
      });
    }

    this.events.emitOrderUpdate(order.outletId, {
      type: "item_served",
      orderId,
      tableId: order.tableId,
      itemId,
      itemName: item.name,
      tableNumber: order.table?.number ?? null,
      inKitchenCount,
      readyCount,
      servedCount,
      orderStatus,
    });

    return this.findOne(orderId);
  }

  async printBill(orderId: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: { orderBy: { id: "asc" } },
        table: true,
        outlet: { include: { brand: true } },
      },
    });

    if (order.status === "settled" || order.status === "cancelled" || order.status === "voided") {
      throw new BadRequestException("Cannot print bill for a closed order");
    }
    if (order.items.length === 0) {
      throw new BadRequestException("Add items before printing the bill");
    }

    const wasBilled = order.status === "billed";

    if (!wasBilled) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: "billed" },
      });
      if (order.tableId) {
        await this.prisma.table.update({
          where: { id: order.tableId },
          data: { status: "billed" },
        });
      }
    }

    const printedAt = new Date();
    const bill = {
      type: "proforma" as const,
      orderNumber: order.orderNumber,
      tableNumber: order.table?.number ?? null,
      guestCount: order.guestCount,
      printedAt: printedAt.toISOString(),
      isReprint: wasBilled,
      outlet: {
        name: order.outlet.name,
        address: order.outlet.address,
        city: order.outlet.city,
        gstin: order.outlet.gstin,
      },
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      subtotal: Number(order.subtotal),
      taxAmount: Number(order.taxAmount),
      totalAmount: Number(order.totalAmount),
      disclaimer: "Proforma bill — not a tax invoice. GST invoice issued on payment.",
    };

    await this.printBridge.printProformaBill(bill);

    const updated = await this.findOne(orderId);
    this.events.emitOrderUpdate(order.outletId, updated);

    return { bill, order: updated };
  }

  async requestBill(orderId: string, userId?: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, table: true },
    });

    if (order.status === "settled" || order.status === "cancelled" || order.status === "voided") {
      throw new BadRequestException("Cannot request bill for a closed order");
    }
    if (order.items.length === 0) {
      throw new BadRequestException("Add items before requesting the bill");
    }

    const now = new Date();
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        billRequestedAt: now,
        billRequestedByUserId: userId ?? null,
      },
    });

    if (order.tableId) {
      await this.prisma.table.update({
        where: { id: order.tableId },
        data: { status: "bill_requested" },
      });
    }

    const updated = await this.findOne(orderId);
    this.events.emitOrderUpdate(order.outletId, {
      type: "bill_requested",
      orderId,
      tableId: order.tableId,
      tableNumber: order.table?.number ?? null,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      billRequestedAt: now.toISOString(),
      order: updated,
    });

    return updated;
  }

  async settle(orderId: string, data: {
    payments: Array<{ method: string; amount: number; reference?: string }>;
    discountAmount?: number; loyaltyPointsUsed?: number; customerPhone?: string;
  }, actor?: { role?: string; permissions?: string[] }) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { menuItem: true } }, outlet: true },
    });

    if (actor?.role === "captain") {
      const billingMode = getOutletBillingMode(order.outlet.settings);
      const perms = actor.permissions ?? [];
      if (billingMode !== "captain_can_settle" || !hasActionPermission(perms, ACTION_PERMISSIONS.settle_bill)) {
        throw new ForbiddenException("Captain cannot settle bills for this outlet");
      }
    }

    if (order.status === "settled") {
      throw new BadRequestException("Order is already settled");
    }

    const discount = data.discountAmount ?? 0;
    const totalPaid = data.payments.reduce((s, p) => s + p.amount, 0);

    if (totalPaid < Number(order.totalAmount) - discount) {
      throw new BadRequestException("Insufficient payment amount");
    }

    for (const item of order.items) {
      await this.inventory.consumeCommittedStock(
        order.outletId,
        item.menuItemId,
        item.quantity,
        orderId,
        item.id,
      );
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

    if (order.reservationId) {
      const reservation = await this.prisma.reservation.update({
        where: { id: order.reservationId },
        data: { status: "completed" },
        include: { table: true, customer: true, order: true },
      });
      this.events.emitReservationUpdate(order.outletId, reservation);
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

  findByOutlet(outletId: string, status?: string, type?: string) {
    return this.prisma.order.findMany({
      where: {
        outletId,
        ...(status ? { status: status as never } : {}),
        ...(type ? { type: type as never } : {}),
      },
      include: { items: true, table: true, payments: true, invoice: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  findOne(id: string) {
    return this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: {
        items: { include: { menuItem: true }, orderBy: { id: "asc" } },
        table: true,
        payments: true,
        invoice: true,
        kots: { include: { kitchenStation: true, items: true }, orderBy: { firedAt: "asc" } },
        customer: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getLiveOrders(outletId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        outletId,
        status: { in: ["open", "kot_fired", "preparing", "ready", "served", "billed"] },
      },
      include: {
        items: { select: { id: true } },
        table: { select: { number: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const buckets = {
      dineIn: 0,
      takeaway: 0,
      ownDelivery: 0,
      swiggy: 0,
      zomato: 0,
      other: 0,
    };

    for (const order of orders) {
      if (order.type === "dine_in") buckets.dineIn += 1;
      else if (order.type === "takeaway") buckets.takeaway += 1;
      else if (order.type === "delivery" && order.source === "swiggy") buckets.swiggy += 1;
      else if (order.type === "delivery" && order.source === "zomato") buckets.zomato += 1;
      else if (order.type === "delivery") buckets.ownDelivery += 1;
      else buckets.other += 1;
    }

    return {
      total: orders.length,
      buckets,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        type: o.type,
        source: o.source,
        status: o.status,
        totalAmount: o.totalAmount,
        tableNumber: o.table?.number ?? null,
        itemCount: o.items.length,
        billRequestedAt: o.billRequestedAt?.toISOString() ?? null,
      })),
    };
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
        status: { in: ["open", "kot_fired", "preparing", "ready"] },
      },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async cancelOrder(orderId: string, reason?: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    if (["settled", "cancelled", "voided"].includes(order.status)) {
      throw new BadRequestException("Order cannot be cancelled in current status");
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: "cancelled",
        notes: reason
          ? [order.notes, `Cancelled: ${reason}`].filter(Boolean).join("\n")
          : order.notes,
      },
      include: { items: true, table: true },
    });

    if (order.externalOrderId && ["swiggy", "zomato", "website"].includes(order.source)) {
      const adapter = createAggregatorAdapter(order.source);
      await adapter.acknowledgeOrder(order.externalOrderId, "rejected");
    }

    this.events.emitOrderUpdate(order.outletId, {
      type: "order_cancelled",
      orderId: order.id,
      source: order.source,
      externalOrderId: order.externalOrderId,
      orderStatus: "cancelled",
    });

    return updated;
  }

  async getKitchenTimeline(orderId: string) {
    type TimelineEntry = {
      at: string;
      type: string;
      label: string;
      kotNumber?: string;
      stationName?: string;
      itemNames?: string[];
    };

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        kots: {
          include: { kitchenStation: true, items: { include: { orderItem: true } } },
          orderBy: { firedAt: "asc" },
        },
        table: true,
      },
    });

    const entries: TimelineEntry[] = [];

    for (const kot of order.kots) {
      entries.push({
        at: kot.firedAt.toISOString(),
        type: "kot_fired",
        label: `${kot.kotNumber} sent to ${kot.kitchenStation.name}`,
        kotNumber: kot.kotNumber,
        stationName: kot.kitchenStation.name,
        itemNames: kot.items.map((i) => `${i.quantity}x ${i.orderItem.name}`),
      });
      if (kot.readyAt) {
        entries.push({
          at: kot.readyAt.toISOString(),
          type: "kot_ready",
          label: `${kot.kotNumber} ready at ${kot.kitchenStation.name}`,
          kotNumber: kot.kotNumber,
          stationName: kot.kitchenStation.name,
          itemNames: kot.items.map((i) => `${i.quantity}x ${i.orderItem.name}`),
        });
      } else if (kot.status === "preparing") {
        entries.push({
          at: kot.firedAt.toISOString(),
          type: "kot_preparing",
          label: `${kot.kotNumber} preparing at ${kot.kitchenStation.name}`,
          kotNumber: kot.kotNumber,
          stationName: kot.kitchenStation.name,
          itemNames: kot.items.map((i) => `${i.quantity}x ${i.orderItem.name}`),
        });
      }
    }

    const org = await this.prisma.outlet.findUnique({
      where: { id: order.outletId },
      select: { brand: { select: { organizationId: true } } },
    });

    if (org) {
      const auditLogs = await this.prisma.auditLog.findMany({
        where: {
          entityId: orderId,
          entityType: "order",
          action: "item_served",
        },
        orderBy: { createdAt: "asc" },
      });

      for (const log of auditLogs) {
        const meta = log.metadata as { itemName?: string; quantity?: number } | null;
        entries.push({
          at: log.createdAt.toISOString(),
          type: "item_served",
          label: `${meta?.quantity ?? 1}x ${meta?.itemName ?? "Item"} served`,
          itemNames: meta?.itemName ? [`${meta.quantity ?? 1}x ${meta.itemName}`] : undefined,
        });
      }
    }

    entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return {
      orderId,
      orderNumber: order.orderNumber,
      tableNumber: order.table?.number ?? null,
      entries,
    };
  }
}
