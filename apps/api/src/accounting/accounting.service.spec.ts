import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@kaana/database";
import { AccountingService } from "./accounting.service";
import { AC } from "./chart-of-accounts";

describe("AccountingService Step 13", () => {
  let prisma: {
    glAccount: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      findMany: jest.Mock;
    };
    journalEntry: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findFirstOrThrow: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    journalLine: { aggregate: jest.Mock; findMany: jest.Mock };
    stockLedger: { findMany: jest.Mock };
    outlet: { findUniqueOrThrow: jest.Mock; findMany: jest.Mock };
    expense: { create: jest.Mock; update: jest.Mock };
    supplierPayment: { create: jest.Mock; update: jest.Mock };
    purchaseInvoice: { update: jest.Mock };
    ingredient: { findMany: jest.Mock };
  };
  let capabilities: { canRestaurantUse: jest.Mock };
  let service: AccountingService;

  const orgId = "org-1";
  const outletId = "out-1";

  const accountsByCode: Record<string, { id: string; code: string; name: string; type: string; isActive: boolean }> = {
    [AC.CASH]: { id: "acc-cash", code: AC.CASH, name: "Cash", type: "asset", isActive: true },
    [AC.UPI]: { id: "acc-upi", code: AC.UPI, name: "UPI", type: "asset", isActive: true },
    [AC.CARD]: { id: "acc-card", code: AC.CARD, name: "Card", type: "asset", isActive: true },
    [AC.SALES]: { id: "acc-sales", code: AC.SALES, name: "Sales", type: "revenue", isActive: true },
    [AC.OUTPUT_CGST]: { id: "acc-cgst", code: AC.OUTPUT_CGST, name: "CGST", type: "liability", isActive: true },
    [AC.OUTPUT_SGST]: { id: "acc-sgst", code: AC.OUTPUT_SGST, name: "SGST", type: "liability", isActive: true },
    [AC.INVENTORY]: { id: "acc-inv", code: AC.INVENTORY, name: "Inventory", type: "asset", isActive: true },
    [AC.GRNI]: { id: "acc-grni", code: AC.GRNI, name: "GRNI", type: "liability", isActive: true },
    [AC.COGS]: { id: "acc-cogs", code: AC.COGS, name: "COGS", type: "expense", isActive: true },
    [AC.WASTAGE]: { id: "acc-waste", code: AC.WASTAGE, name: "Wastage", type: "expense", isActive: true },
    [AC.OPENING_EQUITY]: { id: "acc-obe", code: AC.OPENING_EQUITY, name: "OBE", type: "equity", isActive: true },
    [AC.OPEX]: { id: "acc-opex", code: AC.OPEX, name: "Opex", type: "expense", isActive: true },
    [AC.AP]: { id: "acc-ap", code: AC.AP, name: "AP", type: "liability", isActive: true },
    [AC.OWNER_CAPITAL]: { id: "acc-cap", code: AC.OWNER_CAPITAL, name: "Capital", type: "equity", isActive: true },
    [AC.OWNER_DRAWINGS]: { id: "acc-draw", code: AC.OWNER_DRAWINGS, name: "Drawings", type: "equity", isActive: true },
    [AC.ADJ_LOSS]: { id: "acc-adjl", code: AC.ADJ_LOSS, name: "Adj Loss", type: "expense", isActive: true },
    [AC.IN_TRANSIT]: { id: "acc-transit", code: AC.IN_TRANSIT, name: "In Transit", type: "asset", isActive: true },
  };

  beforeEach(() => {
    prisma = {
      glAccount: {
        upsert: jest.fn().mockImplementation(({ where, create }) =>
          Promise.resolve({ id: `id-${where.organizationId_code.code}`, ...create }),
        ),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const code = where.organizationId_code?.code;
          return Promise.resolve(code ? accountsByCode[code] ?? null : null);
        }),
        findUniqueOrThrow: jest.fn().mockImplementation(({ where }) => {
          const code = where.organizationId_code?.code ?? where.id;
          const acct = code ? accountsByCode[code] : Object.values(accountsByCode).find((a) => a.id === where.id);
          if (!acct) throw new Error("not found");
          return Promise.resolve(acct);
        }),
        findMany: jest.fn().mockResolvedValue(Object.values(accountsByCode)),
      },
      journalEntry: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data, include }) =>
          Promise.resolve({
            id: "je-1",
            ...data,
            lines: data.lines?.create?.map((l: { glAccountId: string; debit: number; credit: number }, i: number) => ({
              id: `jl-${i}`,
              ...l,
              glAccount: Object.values(accountsByCode).find((a) => a.id === l.glAccountId),
            })),
          }),
        ),
        findFirstOrThrow: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      journalLine: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      stockLedger: { findMany: jest.fn().mockResolvedValue([]) },
      outlet: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ brand: { organizationId: orgId } }),
        findMany: jest.fn().mockResolvedValue([{ id: outletId }]),
      },
      expense: {
        create: jest.fn().mockResolvedValue({ id: "exp-1" }),
        update: jest.fn(),
      },
      supplierPayment: {
        create: jest.fn().mockResolvedValue({ id: "sp-1" }),
        update: jest.fn(),
      },
      purchaseInvoice: { update: jest.fn() },
      ingredient: { findMany: jest.fn().mockResolvedValue([]) },
    };
    capabilities = { canRestaurantUse: jest.fn().mockResolvedValue(true) };
    service = new AccountingService(prisma as never, capabilities as never);
  });

  describe("postJournalEntry", () => {
    it("posts a balanced journal", async () => {
      const entry = await service.postJournalEntry({
        organizationId: orgId,
        outletId,
        reference: "TEST-1",
        description: "Test",
        sourceEvent: "manual_test",
        lines: [
          { accountCode: AC.CASH, debit: 100, outletId },
          { accountCode: AC.SALES, credit: 100, outletId },
        ],
      });
      expect(entry.id).toBe("je-1");
      expect(prisma.journalEntry.create).toHaveBeenCalled();
    });

    it("rejects unbalanced journals", async () => {
      await expect(
        service.postJournalEntry({
          organizationId: orgId,
          reference: "BAD",
          description: "Bad",
          sourceEvent: "manual_test",
          lines: [
            { accountCode: AC.CASH, debit: 100 },
            { accountCode: AC.SALES, credit: 99 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("returns existing journal on idempotent retry", async () => {
      const existing = { id: "je-existing", reference: "X" };
      prisma.journalEntry.findUnique.mockResolvedValue(existing);

      const result = await service.postJournalEntry({
        organizationId: orgId,
        reference: "X",
        description: "X",
        sourceEvent: "order_settlement",
        idempotencyKey: "sales:ord-1",
        lines: [
          { accountCode: AC.CASH, debit: 100 },
          { accountCode: AC.SALES, credit: 100 },
        ],
      });

      expect(result).toBe(existing);
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });
  });

  describe("ensureDefaultAccounts", () => {
    it("upserts chart of accounts idempotently", async () => {
      await service.ensureDefaultAccounts(orgId);
      await service.ensureDefaultAccounts(orgId);
      expect(prisma.glAccount.upsert.mock.calls.length).toBeGreaterThan(20);
    });
  });

  describe("postOrderSettlementAccounting", () => {
    it("posts cash sale with GST split", async () => {
      await service.postOrderSettlementAccounting({
        organizationId: orgId,
        outletId,
        orderId: "ord-cash",
        invoice: { taxableAmount: 200, cgstAmount: 5, sgstAmount: 5, totalAmount: 210 },
        payments: [{ method: "cash", amount: 210 }],
      });

      expect(prisma.journalEntry.create).toHaveBeenCalled();
      const salesCall = prisma.journalEntry.create.mock.calls[0][0];
      const lines = salesCall.data.lines.create;
      const debits = lines.reduce((s: number, l: { debit: number }) => s + Number(l.debit), 0);
      const credits = lines.reduce((s: number, l: { credit: number }) => s + Number(l.credit), 0);
      expect(debits).toBe(210);
      expect(credits).toBe(210);
    });

    it("uses UPI clearing for UPI payments", async () => {
      await service.postOrderSettlementAccounting({
        organizationId: orgId,
        outletId,
        orderId: "ord-upi",
        invoice: { taxableAmount: 100, cgstAmount: 2.5, sgstAmount: 2.5, totalAmount: 105 },
        payments: [{ method: "upi", amount: 105 }],
      });

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines[0].glAccountId).toBe(accountsByCode[AC.UPI].id);
    });

    it("posts COGS from recipe consumption ledger", async () => {
      prisma.stockLedger.findMany.mockResolvedValue([
        { totalValue: new Prisma.Decimal(45) },
        { totalValue: new Prisma.Decimal(15) },
      ]);

      await service.postOrderSettlementAccounting({
        organizationId: orgId,
        outletId,
        orderId: "ord-cogs",
        invoice: { taxableAmount: 200, cgstAmount: 5, sgstAmount: 5, totalAmount: 210 },
        payments: [{ method: "cash", amount: 210 }],
      });

      expect(prisma.journalEntry.create).toHaveBeenCalledTimes(2);
      const cogsLines = prisma.journalEntry.create.mock.calls[1][0].data.lines.create;
      expect(Number(cogsLines[0].debit)).toBe(60);
    });
  });

  describe("inventory event posting", () => {
    it("posts GRN to inventory and GRNI", async () => {
      await service.postGoodsReceiptAccounting({
        organizationId: orgId,
        outletId,
        goodsReceiptId: "grn-1",
        grnNumber: "GRN-001",
        totalValue: 1400,
      });

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines.some((l: { glAccountId: string; debit: number }) => l.glAccountId === accountsByCode[AC.INVENTORY].id && Number(l.debit) === 1400)).toBe(true);
      expect(lines.some((l: { glAccountId: string; credit: number }) => l.glAccountId === accountsByCode[AC.GRNI].id && Number(l.credit) === 1400)).toBe(true);
    });

    it("posts wastage expense", async () => {
      await service.postWastageAccounting({
        organizationId: orgId,
        outletId,
        wastageEntryId: "w-1",
        ingredientName: "Chicken",
        costValue: 140,
      });

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(Number(lines[0].debit)).toBe(140);
    });

    it("posts negative stock adjustment as loss", async () => {
      await service.postStockAdjustmentAccounting({
        organizationId: orgId,
        outletId,
        ledgerId: "led-1",
        reference: "adj-1",
        quantity: -2,
        costValue: 560,
      });

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines[0].glAccountId).toBe(accountsByCode[AC.ADJ_LOSS].id);
    });
  });

  describe("reports", () => {
    it("returns balanced trial balance when debits equal credits", async () => {
      prisma.glAccount.findMany.mockResolvedValue([
        { id: "acc-cash", code: AC.CASH, name: "Cash", type: "asset", isActive: true },
        { id: "acc-sales", code: AC.SALES, name: "Sales", type: "revenue", isActive: true },
      ]);
      prisma.journalLine.aggregate
        .mockResolvedValueOnce({ _sum: { debit: new Prisma.Decimal(100), credit: new Prisma.Decimal(0) } })
        .mockResolvedValueOnce({ _sum: { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(100) } });

      const tb = await service.getTrialBalance(orgId, new Date());
      expect(tb.ok).toBe(true);
      expect(tb.totalDebits).toBe(tb.totalCredits);
    });

    it("computes P&L from revenue and expense accounts", async () => {
      prisma.glAccount.findMany.mockResolvedValue([
        { id: "acc-sales", code: AC.SALES, name: "Sales", type: "revenue", isActive: true },
        { id: "acc-cogs", code: AC.COGS, name: "COGS", type: "expense", isActive: true },
      ]);
      prisma.journalLine.aggregate
        .mockResolvedValueOnce({ _sum: { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(500) } })
        .mockResolvedValueOnce({ _sum: { debit: new Prisma.Decimal(150), credit: new Prisma.Decimal(0) } });

      const pl = await service.getProfitAndLoss(orgId, new Date("2025-01-01"), new Date("2025-12-31"));
      expect(pl.netRevenue).toBe(500);
      expect(pl.cogs).toBe(150);
      expect(pl.netProfit).toBe(350);
    });
  });

  describe("manual journal authorization", () => {
    it("requires finance.general_ledger for manual entries", async () => {
      capabilities.canRestaurantUse.mockResolvedValue(false);
      await expect(
        service.postManualJournalEntry({
          organizationId: orgId,
          reference: "M1",
          description: "Manual",
          sourceEvent: "manual_journal",
          lines: [
            { accountCode: AC.CASH, debit: 50 },
            { accountCode: AC.OWNER_CAPITAL, credit: 50 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
