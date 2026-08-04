import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";

@Injectable()
export class KdsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  getStationQueue(stationId: string) {
    return this.prisma.kOT.findMany({
      where: { kitchenStationId: stationId, status: { in: ["pending", "preparing"] } },
      include: {
        order: { include: { table: true } },
        items: { include: { orderItem: true } },
        kitchenStation: true,
      },
      orderBy: { firedAt: "asc" },
    });
  }

  getAggregatedItems(outletId: string) {
    return this.prisma.orderItem.groupBy({
      by: ["name"],
      where: {
        order: { outletId, status: { in: ["kot_fired", "preparing"] } },
        status: { in: ["kot_fired", "pending"] },
      },
      _sum: { quantity: true },
    });
  }

  async markReady(kotId: string) {
    const kot = await this.prisma.kOT.update({
      where: { id: kotId },
      data: { status: "ready", readyAt: new Date() },
      include: { order: true, kitchenStation: true },
    });

    await this.prisma.kOTItem.updateMany({
      where: { kotId },
      data: { status: "ready" },
    });

    this.events.emitKOTUpdate(kot.kitchenStationId, kot);
    this.events.emitOrderUpdate(kot.order.outletId, { id: kot.orderId, status: "ready" });
    return kot;
  }

  async markPreparing(kotId: string) {
    return this.prisma.kOT.update({
      where: { id: kotId },
      data: { status: "preparing" },
    });
  }
}
