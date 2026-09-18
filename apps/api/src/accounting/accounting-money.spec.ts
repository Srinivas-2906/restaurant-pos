import { Prisma } from "@kaana/database";
import { AccountingService } from "./accounting.service";
import { AC } from "./chart-of-accounts";

describe("AccountingService Step 14 money", () => {
  let prisma: Record<string, unknown>;
  let service: AccountingService;

  const orgId = "org-1";
  const outletId = "out-1";

  beforeEach(() => {
    prisma = {
      organization: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ timezone: "Asia/Kolkata" }),
      },
      glAccount: {
        upsert: jest.fn(),
        findUniqueOrThrow: jest.fn().mockImplementation(({ where }) => {
          const code = where.organizationId_code?.code;
          return Promise.resolve({
            id: `acc-${code}`,
            code,
            name: code,
            type: code === AC.SALES ? "revenue" : code === AC.COGS ? "expense" : "asset",
            isActive: true,
          });
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: "acc-1000", code: AC.CASH, name: "Cash", type: "asset", isActive: true },
          { id: "acc-1020", code: AC.UPI, name: "UPI", type: "asset", isActive: true },
          { id: "acc-1030", code: AC.CARD, name: "Card", type: "asset", isActive: true },
          { id: "acc-4000", code: AC.SALES, name: "Sales", type: "revenue", isActive: true },
          { id: "acc-5000", code: AC.COGS, name: "COGS", type: "expense", isActive: true },
          { id: "acc-5300", code: AC.OPEX, name: "Opex", type: "expense", isActive: true },
        ]),
      },
      journalEntry: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      journalLine: {
        aggregate: jest.fn().mockImplementation(({ where }) => {
          const acctId = where.glAccountId;
          if (acctId === "acc-1000") {
            return Promise.resolve({ _sum: { debit: new Prisma.Decimal(50000), credit: new Prisma.Decimal(0) } });
          }
          if (acctId === "acc-4000") {
            return Promise.resolve({ _sum: { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(1000) } });
          }
          return Promise.resolve({ _sum: { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(0) } });
        }),
        findMany: jest.fn().mockResolvedValue([
          { glAccountId: "acc-1000", debit: new Prisma.Decimal(500) },
        ]),
      },
      order: { count: jest.fn().mockResolvedValue(3) },
      stockLedger: { findMany: jest.fn().mockResolvedValue([]) },
      purchaseInvoice: { findMany: jest.fn().mockResolvedValue([]) },
      expense: { findMany: jest.fn().mockResolvedValue([]), findUniqueOrThrow: jest.fn() },
    };
    service = new AccountingService(prisma as never, { canRestaurantUse: jest.fn() } as never);
  });

  it("getAccountBalance returns cash GL balance not sales sum", async () => {
    const balance = await service.getAccountBalance(orgId, AC.CASH, new Date(), outletId);
    expect(balance).toBe(50000);
  });

  it("getMoneySummary returns journal-derived profit and cash in hand", async () => {
    jest.spyOn(service, "getProfitAndLoss").mockResolvedValue({
      from: new Date().toISOString(),
      to: new Date().toISOString(),
      outletId,
      netRevenue: 1000,
      cogs: 200,
      grossProfit: 800,
      netProfit: 700,
      revenue: [{ code: AC.SALES, name: "Sales", amount: 1000 }],
      expenses: [
        { code: AC.COGS, name: "COGS", amount: 200 },
        { code: AC.OPEX, name: "Opex", amount: 100 },
      ],
    });
    jest.spyOn(service, "reconcileAccounting").mockResolvedValue({
      ok: true,
      inventory: { glBalance: 0, valuation: 0, valuationMethod: "x", delta: 0 },
      trialBalance: { ok: true },
      balanceSheet: { ok: true },
      journals: { count: 0 },
    } as never);

    const summary = await service.getMoneySummary(orgId, { period: "today", outletId });
    expect(summary.balances.cashInHand).toBe(50000);
    expect(summary.profit).toBe(700);
    expect(summary.sales).toBe(1000);
    expect(summary.integrity.ok).toBe(true);
  });
});
