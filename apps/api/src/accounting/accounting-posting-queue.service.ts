import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@kaana/database";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingService } from "./accounting.service";

export type PostingSourceType =
  | "order_settlement"
  | "order_cogs"
  | "goods_receipt"
  | "inventory_wastage"
  | "inventory_adjustment_loss"
  | "inventory_adjustment_gain"
  | "inventory_transfer_dispatch"
  | "inventory_transfer_receive"
  | "supplier_invoice"
  | "supplier_payment"
  | "expense"
  | "owner_capital"
  | "owner_drawing";

@Injectable()
export class AccountingPostingQueueService implements OnModuleInit {
  private readonly logger = new Logger(AccountingPostingQueueService.name);

  constructor(
    private prisma: PrismaService,
    private accounting: AccountingService,
  ) {}

  onModuleInit() {
    void this.processPendingJobs(undefined, 100).catch((e) =>
      this.logger.warn(`Startup posting job sweep failed: ${(e as Error).message}`),
    );
  }

  /** Try posting immediately; on failure enqueue for idempotent retry. */
  async runOrEnqueue<T>(opts: {
    organizationId: string;
    outletId?: string | null;
    sourceType: PostingSourceType;
    sourceId: string;
    idempotencyKey: string;
    payload: Prisma.InputJsonValue;
    execute: () => Promise<T>;
    swallowError?: boolean;
  }): Promise<T | null> {
    const existing = await this.prisma.journalEntry.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: opts.organizationId,
          idempotencyKey: opts.idempotencyKey,
        },
      },
    });
    if (existing) return null;

    try {
      return await opts.execute();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.accountingPostingJob.upsert({
        where: {
          organizationId_idempotencyKey: {
            organizationId: opts.organizationId,
            idempotencyKey: opts.idempotencyKey,
          },
        },
        create: {
          organizationId: opts.organizationId,
          outletId: opts.outletId ?? undefined,
          sourceType: opts.sourceType,
          sourceId: opts.sourceId,
          idempotencyKey: opts.idempotencyKey,
          payload: opts.payload,
          status: "pending",
          lastError: message,
        },
        update: {
          status: "pending",
          lastError: message,
          outletId: opts.outletId ?? undefined,
          payload: opts.payload,
        },
      });
      this.logger.error(`Accounting posting queued (${opts.sourceType}:${opts.sourceId}): ${message}`);
      if (!opts.swallowError) throw err;
      return null;
    }
  }

  async processPendingJobs(organizationId?: string, limit = 50) {
    const jobs = await this.prisma.accountingPostingJob.findMany({
      where: { status: "pending", ...(organizationId ? { organizationId } : {}) },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    let processed = 0;
    for (const job of jobs) {
      const ok = await this.processJob(job.id);
      if (ok) processed++;
    }
    return { processed, scanned: jobs.length };
  }

  async processJob(jobId: string): Promise<boolean> {
    const job = await this.prisma.accountingPostingJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === "completed") return false;

    const existing = await this.prisma.journalEntry.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: job.organizationId,
          idempotencyKey: job.idempotencyKey,
        },
      },
    });
    if (existing) {
      await this.prisma.accountingPostingJob.update({
        where: { id: job.id },
        data: { status: "completed", processedAt: new Date(), lastError: null },
      });
      return true;
    }

    await this.prisma.accountingPostingJob.update({
      where: { id: job.id },
      data: { status: "processing", attempts: { increment: 1 } },
    });

    try {
      await this.replayJob(job);
      await this.prisma.accountingPostingJob.update({
        where: { id: job.id },
        data: { status: "completed", processedAt: new Date(), lastError: null },
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.accountingPostingJob.update({
        where: { id: job.id },
        data: { status: "pending", lastError: message },
      });
      return false;
    }
  }

  private async replayJob(job: {
    organizationId: string;
    sourceType: string;
    sourceId: string;
    payload: unknown;
  }) {
    const p = job.payload as Record<string, unknown>;
    switch (job.sourceType as PostingSourceType) {
      case "order_settlement":
        await this.accounting.postOrderSettlementAccounting(p as never);
        break;
      case "order_cogs":
        await this.accounting.postOrderCogs(
          String(p.organizationId),
          String(p.outletId),
          String(p.orderId),
        );
        break;
      case "goods_receipt":
        await this.accounting.postGoodsReceiptAccounting(p as never);
        break;
      case "inventory_wastage":
        await this.accounting.postWastageAccounting(p as never);
        break;
      case "inventory_adjustment_loss":
      case "inventory_adjustment_gain":
        await this.accounting.postStockAdjustmentAccounting(p as never);
        break;
      case "inventory_transfer_dispatch":
        await this.accounting.postTransferDispatchAccounting(p as never);
        break;
      case "inventory_transfer_receive":
        await this.accounting.postTransferReceiveAccounting(p as never);
        break;
      case "supplier_invoice":
        await this.accounting.postPurchaseInvoiceAccounting(p as never);
        break;
      case "supplier_payment":
        await this.accounting.postSupplierPayment(p as never);
        break;
      case "expense":
        await this.accounting.replayExpensePosting(String(p.expenseId));
        break;
      case "owner_capital":
        await this.accounting.postOwnerCapital(p as never);
        break;
      case "owner_drawing":
        await this.accounting.postOwnerDrawing(p as never);
        break;
      default:
        throw new Error(`Unknown posting sourceType: ${job.sourceType}`);
    }
  }

  /** Scan for business events missing journals and enqueue repair jobs. */
  async reconcileMissingAccounting(organizationId: string) {
    let enqueued = 0;

    const settledOrders = await this.prisma.order.findMany({
      where: { status: "settled", outlet: { brand: { organizationId } } },
      select: { id: true, outletId: true },
    });

    for (const order of settledOrders) {
      const salesJe = await this.prisma.journalEntry.findFirst({
        where: { organizationId, sourceEvent: "order_settlement", sourceId: order.id },
      });
      if (!salesJe) {
        const invoice = await this.prisma.invoice.findUnique({ where: { orderId: order.id } });
        const payments = await this.prisma.payment.findMany({
          where: { orderId: order.id, status: "completed" },
        });
        if (invoice && payments.length) {
          await this.runOrEnqueue({
            organizationId,
            outletId: order.outletId,
            sourceType: "order_settlement",
            sourceId: order.id,
            idempotencyKey: `sales:${order.id}`,
            payload: {
              organizationId,
              outletId: order.outletId,
              orderId: order.id,
              invoice,
              payments: payments.map((pay) => ({ method: pay.method, amount: Number(pay.amount) })),
            },
            execute: () =>
              this.accounting.postOrderSettlementAccounting({
                organizationId,
                outletId: order.outletId,
                orderId: order.id,
                invoice,
                payments: payments.map((pay) => ({ method: pay.method, amount: Number(pay.amount) })),
              }),
            swallowError: true,
          });
          enqueued++;
        }
      }

      const cogsJe = await this.prisma.journalEntry.findFirst({
        where: { organizationId, sourceEvent: "order_cogs", sourceId: order.id },
      });
      if (!cogsJe) {
        await this.runOrEnqueue({
          organizationId,
          outletId: order.outletId,
          sourceType: "order_cogs",
          sourceId: order.id,
          idempotencyKey: `cogs:${order.id}`,
          payload: { organizationId, outletId: order.outletId, orderId: order.id },
          execute: () => this.accounting.postOrderCogs(organizationId, order.outletId, order.id),
          swallowError: true,
        });
        enqueued++;
      }
    }

    const expenses = await this.prisma.expense.findMany({
      where: { organizationId, journalEntryId: null },
      select: { id: true, outletId: true },
    });
    for (const exp of expenses) {
      await this.runOrEnqueue({
        organizationId,
        outletId: exp.outletId,
        sourceType: "expense",
        sourceId: exp.id,
        idempotencyKey: `expense:${exp.id}`,
        payload: { expenseId: exp.id },
        execute: () => this.accounting.replayExpensePosting(exp.id),
        swallowError: true,
      });
      enqueued++;
    }

    const payments = await this.prisma.supplierPayment.findMany({
      where: { organizationId, journalEntryId: null },
      select: { id: true },
    });
    for (const pay of payments) {
      enqueued++;
      await this.processSupplierPaymentMissing(pay.id);
    }

    await this.processPendingJobs(organizationId, 200);
    return { enqueued, pending: await this.prisma.accountingPostingJob.count({ where: { organizationId, status: "pending" } }) };
  }

  private async processSupplierPaymentMissing(supplierPaymentId: string) {
    const pay = await this.prisma.supplierPayment.findUniqueOrThrow({ where: { id: supplierPaymentId } });
    await this.runOrEnqueue({
      organizationId: pay.organizationId,
      outletId: pay.outletId,
      sourceType: "supplier_payment",
      sourceId: pay.id,
      idempotencyKey: `supplier-payment:${pay.id}`,
      payload: {
        organizationId: pay.organizationId,
        outletId: pay.outletId,
        supplierPaymentId: pay.id,
        purchaseInvoiceId: pay.purchaseInvoiceId ?? undefined,
        amount: Number(pay.amount),
        paymentMethod: pay.paymentMethod,
        reference: pay.reference ?? undefined,
      },
      execute: () =>
        this.accounting.postSupplierPayment({
          organizationId: pay.organizationId,
          outletId: pay.outletId,
          supplierPaymentId: pay.id,
          purchaseInvoiceId: pay.purchaseInvoiceId ?? undefined,
          amount: Number(pay.amount),
          paymentMethod: pay.paymentMethod,
          reference: pay.reference ?? undefined,
        }),
      swallowError: true,
    });
  }
}
