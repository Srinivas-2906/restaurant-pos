import { Injectable } from "@nestjs/common";
import type { KOTStatus, OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { AuditService } from "../audit/audit.service";
import {
  operationalAuditMetadata,
  type AuditActorContext,
} from "../auth/audit-actor.util";

@Injectable()
export class KdsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
    private audit: AuditService,
  ) {}

  private activeQueueWhere(outletId?: string, stationId?: string): Prisma.KOTWhereInput {
    const orderFilter: Prisma.OrderWhereInput = {
      status: { notIn: ["cancelled", "voided", "settled"] as OrderStatus[] },
    };
    if (outletId) orderFilter.outletId = outletId;
    const activeStatuses: KOTStatus[] = ["pending", "preparing", "ready"];
    return {
      ...(stationId ? { kitchenStationId: stationId } : {}),
      status: { in: activeStatuses },
      order: orderFilter,
    };
  }

  getStationQueue(stationId: string) {
    return this.prisma.kOT.findMany({
      where: this.activeQueueWhere(undefined, stationId),
      include: {
        order: { include: { table: true } },
        items: { include: { orderItem: true } },
        kitchenStation: true,
      },
      orderBy: { firedAt: "asc" },
    });
  }

  /** Single-kitchen view: all in-flight tickets for an outlet (all stations). */
  getOutletQueue(outletId: string) {
    return this.prisma.kOT.findMany({
      where: this.activeQueueWhere(outletId),
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
        order: { outletId, status: { in: ["kot_fired", "preparing", "ready"] } },
        status: { in: ["kot_fired", "preparing", "pending"] },
      },
      _sum: { quantity: true },
    });
  }

  async markReady(kotId: string, actor?: AuditActorContext) {
    const kot = await this.prisma.kOT.update({
      where: { id: kotId },
      data: { status: "ready", readyAt: new Date() },
      include: {
        order: { include: { table: true, items: true } },
        kitchenStation: true,
        items: { include: { orderItem: true } },
      },
    });

    await this.prisma.kOTItem.updateMany({
      where: { kotId },
      data: { status: "ready" },
    });

    const orderItemIds = kot.items.map((i) => i.orderItemId);
    if (orderItemIds.length) {
      await this.prisma.orderItem.updateMany({
        where: { id: { in: orderItemIds } },
        data: { status: "ready" },
      });
    }

    await this.syncOrderKitchenState(kot.orderId, kot, "kot_ready", actor);
    return kot;
  }

  async markPreparing(kotId: string, actor?: AuditActorContext) {
    const kot = await this.prisma.kOT.update({
      where: { id: kotId },
      data: { status: "preparing" },
      include: {
        order: { include: { table: true, items: true } },
        kitchenStation: true,
        items: { include: { orderItem: true } },
      },
    });

    await this.prisma.kOTItem.updateMany({
      where: { kotId },
      data: { status: "preparing" },
    });

    const orderItemIds = kot.items.map((i) => i.orderItemId);
    if (orderItemIds.length) {
      await this.prisma.orderItem.updateMany({
        where: { id: { in: orderItemIds } },
        data: { status: "preparing" },
      });
    }

    await this.syncOrderKitchenState(kot.orderId, kot, "kot_preparing", actor);
    return kot;
  }

  private async syncOrderKitchenState(
    orderId: string,
    kot: {
      id: string;
      kotNumber: string;
      kitchenStationId: string;
      kitchenStation: { name: string };
      items: Array<{ orderItem: { name: string } }>;
      order: { outletId: string; tableId: string | null; table: { number: string } | null; items: Array<{ kotId: string | null; status: string }> };
    },
    action: "kot_ready" | "kot_preparing",
    actor?: AuditActorContext,
  ) {
    const items = await this.prisma.orderItem.findMany({ where: { orderId } });
    const firedItems = items.filter((i) => i.kotId);
    const pendingUnfired = items.filter((i) => !i.kotId).length;
    const inKitchenCount = firedItems.filter((i) => i.status === "kot_fired" || i.status === "preparing").length;
    const readyCount = firedItems.filter((i) => i.status === "ready").length;

    let orderStatus: string;
    if (pendingUnfired > 0) {
      orderStatus = inKitchenCount > 0 || readyCount > 0 ? "preparing" : "open";
    } else if (firedItems.length > 0 && readyCount === firedItems.length) {
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
      where: { id: kot.order.outletId },
      select: { brand: { select: { organizationId: true } } },
    });

    if (org) {
      await this.audit.log({
        organizationId: org.brand.organizationId,
        userId: actor?.authMode === "operational" ? undefined : actor?.userId,
        outletId: kot.order.outletId,
        action,
        entityType: "order",
        entityId: orderId,
        metadata: operationalAuditMetadata(actor, {
          kotId: kot.id,
          kotNumber: kot.kotNumber,
          stationName: kot.kitchenStation.name,
          tableNumber: kot.order.table?.number ?? null,
          itemNames: kot.items.map((i) => i.orderItem.name),
        }),
      });
    }

    this.events.emitKOTUpdate(kot.kitchenStationId, kot);

    this.events.emitOrderUpdate(kot.order.outletId, {
      type: action,
      orderId,
      tableId: kot.order.tableId,
      kotId: kot.id,
      kotNumber: kot.kotNumber,
      stationName: kot.kitchenStation.name,
      tableNumber: kot.order.table?.number ?? null,
      itemNames: kot.items.map((i) => i.orderItem.name),
      readyCount,
      inKitchenCount,
      orderStatus,
    });
  }
}
