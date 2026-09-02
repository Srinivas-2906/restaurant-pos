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
        terminals: {
          select: {
            id: true,
            name: true,
            code: true,
            isMaster: true,
            isActive: true,
            deviceType: true,
            isRegistered: true,
          },
        },
        kitchenStations: true,
        floorPlans: { include: { tables: true } },
        brand: true,
      },
    });
  }

  async create(data: {
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
    const outlet = await this.prisma.outlet.create({ data: data as never });
    if (data.type === "dine_in") {
      await this.bootstrapDineInOutlet(outlet.id);
    }
    return this.findOne(outlet.id);
  }

  update(
    id: string,
    data: {
      name?: string;
      address?: string;
      city?: string;
      state?: string;
      isActive?: boolean;
    },
  ) {
    return this.prisma.outlet.update({
      where: { id },
      data,
    });
  }

  softDelete(id: string) {
    return this.prisma.outlet.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async bootstrapDineInOutlet(outletId: string) {
    await this.prisma.kitchenStation.createMany({
      data: [
        { outletId, name: "Tandoor", code: "TANDOOR", sortOrder: 1 },
        { outletId, name: "Main Kitchen", code: "MAIN", sortOrder: 2 },
        { outletId, name: "Bar", code: "BAR", sortOrder: 3 },
      ],
    });

    await this.prisma.terminal.create({
      data: {
        outletId,
        name: "Main Counter",
        code: "T1",
        isMaster: true,
      },
    });

    const floorPlan = await this.prisma.floorPlan.create({
      data: {
        outletId,
        name: "Ground Floor",
        isDefault: true,
      },
    });

    await Promise.all(
      ["T1", "T2", "T3", "T4", "T5", "T6"].map((num, i) =>
        this.prisma.table.create({
          data: {
            floorPlanId: floorPlan.id,
            number: num,
            capacity: i < 4 ? 4 : 6,
            posX: (i % 3) * 120,
            posY: Math.floor(i / 3) * 120,
          },
        }),
      ),
    );
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
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const [openOrders, todayReservations] = await Promise.all([
      tableIds.length
        ? this.prisma.order.findMany({
            where: {
              outletId,
              tableId: { in: tableIds },
              status: { in: ["draft", "open", "kot_fired", "preparing", "ready", "served", "billed"] },
            },
            include: { items: true, kots: true },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      this.prisma.reservation.findMany({
        where: {
          outletId,
          date: { gte: start, lte: end },
          status: { in: ["confirmed", "arrived", "seated"] },
          tableId: { in: tableIds },
        },
        orderBy: { date: "asc" },
      }),
    ]);

    const latestByTable = new Map<string, (typeof openOrders)[0]>();
    for (const order of openOrders) {
      if (order.tableId && !latestByTable.has(order.tableId)) {
        latestByTable.set(order.tableId, order);
      }
    }

    const reservationByTable = new Map<string, (typeof todayReservations)[0]>();
    for (const r of todayReservations) {
      if (r.tableId && !reservationByTable.has(r.tableId)) {
        reservationByTable.set(r.tableId, r);
      }
    }

    const reservationSummary = (r: (typeof todayReservations)[0]) => ({
      id: r.id,
      guestName: r.guestName,
      guestCount: r.guestCount,
      date: r.date.toISOString(),
      status: r.status,
    });

    return {
      ...floorPlan,
      tables: floorPlan.tables.map((table) => {
        const order = latestByTable.get(table.id);
        const reservation = reservationByTable.get(table.id);
        const activeReservation = reservation && table.status === "reserved" ? reservationSummary(reservation) : undefined;
        const upcomingReservation = reservation && !order ? reservationSummary(reservation) : undefined;

        if (!order) {
          return { ...table, activeOrder: null, activeReservation, upcomingReservation };
        }

        const itemQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
        const pendingKot = order.items.filter((item) => !item.kotId).length;
        const inKitchen = order.items.filter(
          (item) => item.kotId && (item.status === "kot_fired" || item.status === "preparing"),
        ).length;
        const readyCount = order.items.filter((item) => item.status === "ready").length;
        const servedCount = order.items.filter((item) => item.status === "served").length;
        const firedCount = order.items.filter((item) => item.kotId).length;
        const allReady = firedCount > 0 && readyCount === firedCount;
        const allServed = firedCount > 0 && servedCount === firedCount;
        const elapsedMins = Math.floor((Date.now() - order.createdAt.getTime()) / 60_000);

        return {
          ...table,
          activeReservation,
          upcomingReservation,
          activeOrder: {
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            totalAmount: order.totalAmount,
            itemCount: order.items.length,
            itemQty,
            pendingKot,
            inKitchen,
            readyCount,
            servedCount,
            allReady,
            allServed,
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
