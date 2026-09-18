import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import type {
  PosCommandEnvelope,
  PosSyncBatchRequest,
  PosSyncBatchResponse,
  PosSyncCommandResult,
} from "@kaana/sync-protocol";
import { ACTIVE_ORDER_STATUSES } from "../orders/order.constants";

@Injectable()
export class PosSyncService {
  private readonly logger = new Logger(PosSyncService.name);

  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
  ) {}

  async ingestBatch(batch: PosSyncBatchRequest): Promise<PosSyncBatchResponse> {
    const sorted = [...batch.commands].sort((a, b) => a.sequence - b.sequence);
    const results: PosSyncCommandResult[] = [];
    let lastAckSequence = batch.lastAckSequence ?? 0;
    const cloudMappings: Record<string, string> = {};

    for (const cmd of sorted) {
      const result = await this.processCommand(batch, cmd, cloudMappings);
      results.push(result);
      if (result.status === "acked" && cmd.sequence > lastAckSequence) {
        lastAckSequence = cmd.sequence;
      }
      if (result.serverEntityId && result.cloudMappings) {
        Object.assign(cloudMappings, result.cloudMappings);
      }
    }

    return {
      results,
      lastAckSequence,
      menuUpdatedAt: new Date().toISOString(),
    };
  }

  private async processCommand(
    batch: PosSyncBatchRequest,
    cmd: PosCommandEnvelope,
    mappings: Record<string, string>,
  ): Promise<PosSyncCommandResult> {
    const existing = await this.prisma.posSyncCommand.findUnique({
      where: {
        outletId_deviceId_idempotencyKey: {
          outletId: batch.outletId,
          deviceId: batch.deviceId,
          idempotencyKey: cmd.idempotencyKey,
        },
      },
    });

    if (existing?.status === "acked") {
      const prev = existing.result as Record<string, unknown> | null;
      return {
        commandId: cmd.id,
        idempotencyKey: cmd.idempotencyKey,
        status: "acked",
        serverEntityId: existing.serverEntityId ?? undefined,
        cloudMappings: prev?.cloudMappings as Record<string, string> | undefined,
      };
    }

    try {
      const outcome = await this.applyCommand(batch, cmd, mappings);
      await this.prisma.posSyncCommand.upsert({
        where: {
          outletId_deviceId_idempotencyKey: {
            outletId: batch.outletId,
            deviceId: batch.deviceId,
            idempotencyKey: cmd.idempotencyKey,
          },
        },
        create: {
          outletId: batch.outletId,
          deviceId: batch.deviceId,
          idempotencyKey: cmd.idempotencyKey,
          operationType: cmd.operationType,
          localEntityId: cmd.localEntityId,
          serverEntityId: outcome.serverEntityId,
          status: outcome.status === "conflict" ? "conflict" : "acked",
          result: outcome as never,
          occurredAt: cmd.occurredAt ? new Date(cmd.occurredAt) : undefined,
        },
        update: {
          serverEntityId: outcome.serverEntityId,
          status: outcome.status === "conflict" ? "conflict" : "acked",
          result: outcome as never,
        },
      });
      return {
        commandId: cmd.id,
        idempotencyKey: cmd.idempotencyKey,
        status: outcome.status,
        serverEntityId: outcome.serverEntityId,
        cloudMappings: outcome.cloudMappings,
        conflict: outcome.conflict,
        error: outcome.error,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      this.logger.warn(`POS sync command failed: ${cmd.operationType} ${cmd.idempotencyKey}: ${message}`);
      if (existing) {
        await this.prisma.posSyncCommand.update({
          where: { id: existing.id },
          data: { status: "failed", error: message },
        });
      } else {
        await this.prisma.posSyncCommand.create({
          data: {
            outletId: batch.outletId,
            deviceId: batch.deviceId,
            idempotencyKey: cmd.idempotencyKey,
            operationType: cmd.operationType,
            localEntityId: cmd.localEntityId,
            status: "failed",
            error: message,
            occurredAt: cmd.occurredAt ? new Date(cmd.occurredAt) : undefined,
          },
        });
      }
      return {
        commandId: cmd.id,
        idempotencyKey: cmd.idempotencyKey,
        status: "rejected",
        error: message,
      };
    }
  }

  private async applyCommand(
    batch: PosSyncBatchRequest,
    cmd: PosCommandEnvelope,
    mappings: Record<string, string>,
  ): Promise<{
    status: "acked" | "conflict" | "rejected";
    serverEntityId?: string;
    cloudMappings?: Record<string, string>;
    conflict?: PosSyncCommandResult["conflict"];
    error?: string;
  }> {
    switch (cmd.operationType) {
      case "CREATE_ORDER":
        return this.applyCreateOrder(batch, cmd, mappings);
      case "ADD_ITEM":
        return this.applyAddItem(cmd, mappings);
      case "UPDATE_ITEM_QTY":
        return this.applyUpdateItemQty(cmd, mappings);
      case "REMOVE_ITEM":
        return this.applyRemoveItem(cmd, mappings);
      case "FIRE_KOT":
        return this.applyFireKot(cmd, mappings);
      case "SETTLE":
        return this.applySettle(batch, cmd, mappings);
      case "CANCEL_ORDER":
        return this.applyCancelOrder(cmd, mappings);
      default:
        throw new BadRequestException(`Unsupported operation: ${cmd.operationType}`);
    }
  }

  private async resolveServerOrderId(
    cmd: PosCommandEnvelope,
    mappings: Record<string, string>,
  ): Promise<string> {
    const fromMapping = mappings[cmd.aggregateId];
    if (fromMapping) return fromMapping;

    const payload = cmd.payload;
    if (payload.serverOrderId && typeof payload.serverOrderId === "string") {
      return payload.serverOrderId;
    }

    const byClient = await this.prisma.order.findFirst({
      where: { outletId: cmd.outletId, clientOrderId: cmd.aggregateId },
    });
    if (byClient) return byClient.id;

    throw new BadRequestException(`Order not found for aggregate ${cmd.aggregateId}`);
  }

  private async applyCreateOrder(
    batch: PosSyncBatchRequest,
    cmd: PosCommandEnvelope,
    mappings: Record<string, string>,
  ) {
    const payload = cmd.payload;
    const clientOrderId = (payload.clientOrderId as string) ?? cmd.aggregateId;
    const tableId = payload.tableId as string | undefined;

    const existing = await this.prisma.order.findFirst({
      where: { outletId: batch.outletId, clientOrderId },
    });
    if (existing) {
      mappings[clientOrderId] = existing.id;
      return {
        status: "acked" as const,
        serverEntityId: existing.id,
        cloudMappings: { [clientOrderId]: existing.id },
      };
    }

    if (tableId) {
      const tableConflict = await this.prisma.order.findFirst({
        where: {
          outletId: batch.outletId,
          tableId,
          status: { in: [...ACTIVE_ORDER_STATUSES] },
        },
        include: { table: true },
      });
      if (tableConflict) {
        return {
          status: "conflict" as const,
          conflict: {
            code: "TABLE_OCCUPIED",
            message: `Table ${tableConflict.table?.number ?? tableId} already has an active order`,
            serverState: {
              serverOrderId: tableConflict.id,
              orderNumber: tableConflict.orderNumber,
              tableId,
            },
            resolutionOptions: ["move_table", "convert_takeaway", "manual_resolve"],
          },
        };
      }
    }

    const order = await this.orders.createWithOfflineProvenance({
      outletId: batch.outletId,
      terminalId: batch.terminalId,
      tableId,
      type: (payload.type as string) ?? "takeaway",
      source: "pos",
      guestCount: (payload.guestCount as number) ?? 1,
      notes: payload.notes as string | undefined,
      clientOrderId,
      occurredAt: cmd.occurredAt,
      createdByStaffProfileId: cmd.staffProfileId,
      actor: {
        authMode: "operational" as const,
        staffProfileId: cmd.staffProfileId,
        employeeCode: cmd.employeeCode,
        terminalId: batch.terminalId,
      },
    });

    mappings[clientOrderId] = order.id;
    return {
      status: "acked" as const,
      serverEntityId: order.id,
      cloudMappings: { [clientOrderId]: order.id },
    };
  }

  private async applyAddItem(cmd: PosCommandEnvelope, mappings: Record<string, string>) {
    const orderId = await this.resolveServerOrderId(cmd, mappings);
    const p = cmd.payload;
    const item = await this.orders.addItemFromSnapshot(orderId, {
      localItemId: p.localItemId as string | undefined,
      menuItemId: p.menuItemId as string,
      name: p.name as string,
      quantity: (p.quantity as number) ?? 1,
      unitPrice: Number(p.unitPrice),
      taxAmount: Number(p.taxAmount ?? 0),
      variantId: p.variantId as string | undefined,
      notes: p.notes as string | undefined,
      menuItemUpdatedAt: p.menuItemUpdatedAt as string | undefined,
    });
    return {
      status: "acked" as const,
      serverEntityId: item.id,
      cloudMappings: p.localItemId ? { [p.localItemId as string]: item.id } : undefined,
    };
  }

  private async applyUpdateItemQty(cmd: PosCommandEnvelope, mappings: Record<string, string>) {
    const orderId = await this.resolveServerOrderId(cmd, mappings);
    const p = cmd.payload;
    const serverItemId =
      (p.serverItemId as string) ??
      (p.localItemId ? mappings[p.localItemId as string] : undefined) ??
      (p.localItemId as string);
    await this.orders.updateItemQuantity(orderId, serverItemId, p.quantity as number);
    return { status: "acked" as const, serverEntityId: serverItemId };
  }

  private async applyRemoveItem(cmd: PosCommandEnvelope, mappings: Record<string, string>) {
    const orderId = await this.resolveServerOrderId(cmd, mappings);
    const p = cmd.payload;
    const serverItemId =
      (p.serverItemId as string) ??
      (p.localItemId ? mappings[p.localItemId as string] : undefined) ??
      (p.localItemId as string);
    await this.orders.removeItem(orderId, serverItemId);
    return { status: "acked" as const, serverEntityId: serverItemId };
  }

  private async applyFireKot(cmd: PosCommandEnvelope, mappings: Record<string, string>) {
    const orderId = await this.resolveServerOrderId(cmd, mappings);
    const kots = await this.orders.fireKOT(orderId, {
      authMode: "operational",
      staffProfileId: cmd.staffProfileId,
      employeeCode: cmd.employeeCode,
      terminalId: cmd.terminalId,
    });
    return {
      status: "acked" as const,
      serverEntityId: orderId,
      cloudMappings: Object.fromEntries(kots.map((k) => [k.id, k.id])),
    };
  }

  private async applySettle(
    batch: PosSyncBatchRequest,
    cmd: PosCommandEnvelope,
    mappings: Record<string, string>,
  ) {
    const orderId = await this.resolveServerOrderId(cmd, mappings);
    const p = cmd.payload;
    const permissions = (p.permissions as string[]) ?? [];

    const result = await this.orders.settle(
      orderId,
      {
        payments: p.payments as Array<{ method: string; amount: number; reference?: string }>,
        discountAmount: (p.discountAmount as number) ?? 0,
        loyaltyPointsUsed: (p.loyaltyPointsUsed as number) ?? 0,
        customerPhone: p.customerPhone as string | undefined,
        idempotencyKey: cmd.idempotencyKey,
        occurredAt: cmd.occurredAt,
      },
      {
        role: p.role as string | undefined,
        permissions,
        actor: {
          authMode: "operational",
          staffProfileId: cmd.staffProfileId,
          employeeCode: cmd.employeeCode,
          terminalId: batch.terminalId,
        },
      },
    );

    return {
      status: "acked" as const,
      serverEntityId: orderId,
      cloudMappings: {
        [cmd.aggregateId]: orderId,
        [`invoice:${cmd.aggregateId}`]: result.invoice?.id ?? "",
      },
    };
  }

  private async applyCancelOrder(cmd: PosCommandEnvelope, mappings: Record<string, string>) {
    const orderId = await this.resolveServerOrderId(cmd, mappings);
    await this.orders.cancelOrder(orderId, cmd.payload.reason as string | undefined, {
      authMode: "operational",
      staffProfileId: cmd.staffProfileId,
      employeeCode: cmd.employeeCode,
      terminalId: cmd.terminalId,
    });
    return { status: "acked" as const, serverEntityId: orderId };
  }
}
