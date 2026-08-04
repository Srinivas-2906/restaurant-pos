import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { SyncBatchRequest, SyncBatchResponse } from "@kaana/sync-protocol";

@Injectable()
export class SyncService {
  constructor(private prisma: PrismaService) {}

  async enqueue(data: {
    outletId: string; userId?: string; clientId: string;
    entityType: string; entityId: string; action: string; payload: Record<string, unknown>;
  }) {
    return this.prisma.syncEvent.create({
      data: {
        outletId: data.outletId,
        userId: data.userId,
        clientId: data.clientId,
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        payload: data.payload as never,
        status: "pending",
      },
    });
  }

  async ingestBatch(batch: SyncBatchRequest): Promise<SyncBatchResponse> {
    const accepted: string[] = [];
    const rejected: Array<{ id: string; reason: string }> = [];
    let lastAckSequence = batch.lastAckSequence ?? 0;

    for (const event of batch.events) {
      try {
        const existing = await this.prisma.syncEvent.findFirst({
          where: { clientId: batch.hubId, entityId: event.entityId, action: event.action },
        });
        if (existing?.status === "synced") {
          accepted.push(event.id);
          continue;
        }

        await this.prisma.syncEvent.upsert({
          where: { id: event.id },
          create: {
            id: event.id,
            outletId: batch.outletId,
            clientId: batch.hubId,
            entityType: event.entityType,
            entityId: event.entityId,
            action: event.action,
            payload: event.payload as never,
            status: "synced",
            syncedAt: new Date(),
          },
          update: { status: "synced", syncedAt: new Date() },
        });

        await this.applyEvent(event);
        accepted.push(event.id);
        if (event.sequence > lastAckSequence) lastAckSequence = event.sequence;
      } catch (err) {
        rejected.push({ id: event.id, reason: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    return { accepted, rejected, lastAckSequence };
  }

  private async applyEvent(event: SyncBatchRequest["events"][0]) {
    if (event.entityType === "order" && event.action === "create") {
      const payload = event.payload as Record<string, unknown>;
      const existing = await this.prisma.order.findFirst({
        where: { outletId: event.outletId, orderNumber: payload.orderNumber as string },
      });
      if (!existing) {
        await this.prisma.order.create({
          data: {
            id: event.entityId,
            outletId: event.outletId,
            orderNumber: (payload.orderNumber as string) ?? event.entityId,
            source: "dine_in",
            type: "dine_in",
            status: "open",
            guestCount: (payload.guestCount as number) ?? 1,
            tableId: payload.tableId as string | undefined,
            terminalId: payload.terminalId as string | undefined,
          },
        });
      }
    }
    if (event.entityType === "order" && event.action === "update") {
      const payload = event.payload as Record<string, unknown>;
      if (payload.status) {
        await this.prisma.order.updateMany({
          where: { id: event.entityId },
          data: { status: payload.status as never, settledAt: payload.status === "settled" ? new Date() : undefined },
        });
      }
    }
  }

  async getPending(clientId: string) {
    return this.prisma.syncEvent.findMany({
      where: { clientId, status: "pending" },
      orderBy: { createdAt: "asc" },
    });
  }

  async markSynced(id: string) {
    return this.prisma.syncEvent.update({
      where: { id },
      data: { status: "synced", syncedAt: new Date() },
    });
  }

  async replay(clientId: string) {
    const pending = await this.getPending(clientId);
    const results: Array<{ id: string; status: string }> = [];

    for (const event of pending) {
      try {
        await this.applyEvent({
          id: event.id,
          idempotencyKey: event.id,
          outletId: event.outletId,
          deviceId: clientId,
          entityType: event.entityType as never,
          entityId: event.entityId,
          action: event.action as never,
          payload: event.payload as Record<string, unknown>,
          clientTimestamp: event.createdAt.toISOString(),
          sequence: 0,
        });
        await this.markSynced(event.id);
        results.push({ id: event.id, status: "synced" });
      } catch {
        await this.prisma.syncEvent.update({
          where: { id: event.id },
          data: { status: "failed" },
        });
        results.push({ id: event.id, status: "failed" });
      }
    }

    return { replayed: results.length, results };
  }
}
