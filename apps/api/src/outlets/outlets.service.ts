import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OutletsService {
  constructor(private prisma: PrismaService) {}

  findByBrand(brandId: string) {
    return this.prisma.outlet.findMany({
      where: { brandId, isActive: true },
      include: { terminals: true, kitchenStations: true },
    });
  }

  findOne(id: string) {
    return this.prisma.outlet.findUniqueOrThrow({
      where: { id },
      include: {
        terminals: true,
        kitchenStations: true,
        floorPlans: { include: { tables: true } },
        brand: true,
      },
    });
  }

  create(data: {
    brandId: string;
    name: string;
    code: string;
    type: string;
    address?: string;
    city?: string;
    state?: string;
    gstin?: string;
    zone?: string;
  }) {
    return this.prisma.outlet.create({ data: data as never });
  }

  getFloorPlan(outletId: string) {
    return this.getFloorPlanWithOrders(outletId);
  }

  async getFloorPlanWithOrders(outletId: string) {
    const floorPlan = await this.prisma.floorPlan.findFirst({
      where: { outletId, isDefault: true },
      include: { tables: { orderBy: { number: "asc" } } },
    });

    if (!floorPlan) return null;

    const tableIds = floorPlan.tables.map((t) => t.id);
    const openOrders = tableIds.length
      ? await this.prisma.order.findMany({
          where: {
            outletId,
            tableId: { in: tableIds },
            status: { in: ["draft", "open", "kot_fired", "preparing", "ready", "served", "billed"] },
          },
          include: { items: true, kots: true },
          orderBy: { createdAt: "desc" },
        })
      : [];

    const latestByTable = new Map<string, (typeof openOrders)[0]>();
    for (const order of openOrders) {
      if (order.tableId && !latestByTable.has(order.tableId)) {
        latestByTable.set(order.tableId, order);
      }
    }

    return {
      ...floorPlan,
      tables: floorPlan.tables.map((table) => {
        const order = latestByTable.get(table.id);
        if (!order) {
          return { ...table, activeOrder: null };
        }

        const itemQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
        const pendingKot = order.items.filter((item) => !item.kotId).length;
        const inKitchen = order.items.filter((item) => item.kotId).length;
        const elapsedMins = Math.floor((Date.now() - order.createdAt.getTime()) / 60_000);

        return {
          ...table,
          activeOrder: {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            totalAmount: order.totalAmount,
            itemCount: order.items.length,
            itemQty,
            pendingKot,
            inKitchen,
            kotCount: order.kots.length,
            createdAt: order.createdAt.toISOString(),
            elapsedMins,
          },
        };
      }),
    };
  }

  updateTableStatus(tableId: string, status: string) {
    return this.prisma.table.update({
      where: { id: tableId },
      data: { status: status as never },
    });
  }

  createTerminal(outletId: string, data: { name: string; code: string; isMaster?: boolean }) {
    return this.prisma.terminal.create({
      data: { outletId, ...data },
    });
  }
}
