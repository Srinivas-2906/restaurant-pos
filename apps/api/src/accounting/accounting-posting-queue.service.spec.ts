import { Prisma } from "@kaana/database";
import { AccountingPostingQueueService } from "./accounting-posting-queue.service";
import { AccountingService } from "./accounting.service";

describe("AccountingPostingQueueService", () => {
  let prisma: {
    journalEntry: { findUnique: jest.Mock; findFirst: jest.Mock };
    accountingPostingJob: {
      upsert: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    order: { findMany: jest.Mock };
    invoice: { findUnique: jest.Mock };
    payment: { findMany: jest.Mock };
    expense: { findMany: jest.Mock };
    supplierPayment: { findMany: jest.Mock; findUniqueOrThrow: jest.Mock };
  };
  let accounting: {
    postOrderSettlementAccounting: jest.Mock;
    postOrderCogs: jest.Mock;
    replayExpensePosting: jest.Mock;
    postSupplierPayment: jest.Mock;
  };
  let service: AccountingPostingQueueService;

  beforeEach(() => {
    prisma = {
      journalEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      accountingPostingJob: {
        upsert: jest.fn().mockResolvedValue({ id: "job-1" }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      order: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { findUnique: jest.fn() },
      payment: { findMany: jest.fn() },
      expense: { findMany: jest.fn().mockResolvedValue([]) },
      supplierPayment: { findMany: jest.fn().mockResolvedValue([]), findUniqueOrThrow: jest.fn() },
    };
    accounting = {
      postOrderSettlementAccounting: jest.fn().mockResolvedValue(undefined),
      postOrderCogs: jest.fn().mockResolvedValue(undefined),
      replayExpensePosting: jest.fn().mockResolvedValue(undefined),
      postSupplierPayment: jest.fn().mockResolvedValue({ id: "je-1" }),
    };
    service = new AccountingPostingQueueService(prisma as never, accounting as never);
  });

  it("executes posting immediately when successful", async () => {
    const result = await service.runOrEnqueue({
      organizationId: "org-1",
      outletId: "out-1",
      sourceType: "order_settlement",
      sourceId: "ord-1",
      idempotencyKey: "sales:ord-1",
      payload: {},
      execute: () => accounting.postOrderSettlementAccounting({} as never),
    });
    expect(accounting.postOrderSettlementAccounting).toHaveBeenCalled();
    expect(prisma.accountingPostingJob.upsert).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("enqueues job when posting fails and swallowError is true", async () => {
    accounting.postOrderSettlementAccounting.mockRejectedValue(new Error("GL down"));
    const result = await service.runOrEnqueue({
      organizationId: "org-1",
      outletId: "out-1",
      sourceType: "order_settlement",
      sourceId: "ord-1",
      idempotencyKey: "sales:ord-1",
      payload: { orderId: "ord-1" },
      execute: () => accounting.postOrderSettlementAccounting({} as never),
      swallowError: true,
    });
    expect(prisma.accountingPostingJob.upsert).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("skips execute when journal already exists", async () => {
    prisma.journalEntry.findUnique.mockResolvedValue({ id: "existing" });
    await service.runOrEnqueue({
      organizationId: "org-1",
      sourceType: "order_settlement",
      sourceId: "ord-1",
      idempotencyKey: "sales:ord-1",
      payload: {},
      execute: () => accounting.postOrderSettlementAccounting({} as never),
    });
    expect(accounting.postOrderSettlementAccounting).not.toHaveBeenCalled();
  });

  it("reconcileMissingAccounting enqueues expenses without journals", async () => {
    prisma.expense.findMany.mockResolvedValue([{ id: "exp-1", outletId: "out-1" }]);
    const result = await service.reconcileMissingAccounting("org-1");
    expect(result.enqueued).toBeGreaterThan(0);
    expect(accounting.replayExpensePosting).toHaveBeenCalled();
  });
});
