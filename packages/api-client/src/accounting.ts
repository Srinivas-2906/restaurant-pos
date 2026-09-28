import type { ApiClient } from "./http";

export type MoneyPeriodPreset = "today" | "yesterday" | "week" | "month" | "custom";

export type MoneySummary = {
  period: {
    preset: MoneyPeriodPreset;
    label: string;
    from: string;
    to: string;
    timeZone: string;
  };
  outletId?: string;
  integrity: { ok: boolean; warning?: string };
  sales: number;
  orders: number;
  expenses: number;
  operatingExpenses: number;
  wastageExpense: number;
  profit: number;
  profitSummary: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    operatingExpenses: number;
    netProfit: number;
  };
  paymentBreakdown: { cash: number; upi: number; card: number };
  balances: {
    cashInHand: number;
    bank: number;
    upiPendingSettlement: number;
    cardPendingSettlement: number;
  };
  supplierDue: number;
  inventoryValue: number | null;
  inventoryReconciled: boolean;
  dailySummary: {
    sales: number;
    orders: number;
    cashSales: number;
    upiSales: number;
    cardSales: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
  };
};

export type MoneyActivityItem = {
  id: string;
  date: string;
  type: string;
  description: string;
  amount: number;
  direction: "in" | "out" | "neutral";
  paymentMethod?: string;
  outletId?: string | null;
  sourceEvent: string;
  sourceId?: string | null;
};

export type SupplierDueBill = {
  billId: string;
  supplierId: string;
  supplierName: string;
  billNumber: string;
  billTotal: number;
  paid: number;
  remaining: number;
  dueDate?: string;
  outletId: string;
};

export type SupplierDues = {
  totalOutstanding: number;
  apBalance: number;
  bills: SupplierDueBill[];
};

export type ExpenseItem = {
  id: string;
  amount: number;
  description: string;
  categoryCode: string;
  categoryName: string;
  paymentMethod: string;
  expenseDate: string;
  outletId: string;
  outletName: string;
};

export type ExpenseCategory = { code: string; label: string };

export type ProfitAndLossReport = {
  from: string;
  to: string;
  outletId?: string;
  revenue: Array<{ code: string; name: string; amount: number }>;
  expenses: Array<{ code: string; name: string; amount: number }>;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  netProfit: number;
};

export type BalanceSheetReport = {
  ok: boolean;
  asOf: string;
  outletId?: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  retainedEarnings: number;
  equation: { assets: number; liabilitiesPlusEquity: number };
};

export function createAccountingApi(client: ApiClient) {
  return {
    moneySummary(params: { period?: MoneyPeriodPreset; from?: string; to?: string; outletId?: string } = {}) {
      const q = new URLSearchParams();
      if (params.period) q.set("period", params.period);
      if (params.from) q.set("from", params.from);
      if (params.to) q.set("to", params.to);
      if (params.outletId) q.set("outletId", params.outletId);
      const qs = q.toString();
      return client.api<MoneySummary>(`/accounting/money-summary${qs ? `?${qs}` : ""}`);
    },

    moneyActivity(params: { from?: string; to?: string; outletId?: string; limit?: number } = {}) {
      const q = new URLSearchParams();
      if (params.from) q.set("from", params.from);
      if (params.to) q.set("to", params.to);
      if (params.outletId) q.set("outletId", params.outletId);
      if (params.limit) q.set("limit", String(params.limit));
      const qs = q.toString();
      return client.api<MoneyActivityItem[]>(`/accounting/money/activity${qs ? `?${qs}` : ""}`);
    },

    supplierDues(outletId?: string) {
      const q = outletId ? `?outletId=${outletId}` : "";
      return client.api<SupplierDues>(`/accounting/supplier-dues${q}`);
    },

    listExpenses(params: { from?: string; to?: string; outletId?: string; categoryCode?: string } = {}) {
      const q = new URLSearchParams();
      if (params.from) q.set("from", params.from);
      if (params.to) q.set("to", params.to);
      if (params.outletId) q.set("outletId", params.outletId);
      if (params.categoryCode) q.set("categoryCode", params.categoryCode);
      const qs = q.toString();
      return client.api<ExpenseItem[]>(`/accounting/expenses${qs ? `?${qs}` : ""}`);
    },

    expenseCategories() {
      return client.api<ExpenseCategory[]>("/accounting/expense-categories");
    },

    createExpense(body: {
      outletId: string;
      amount: number;
      description: string;
      paymentMethod: string;
      expenseDate?: string;
      expenseAccountCode?: string;
      supplierId?: string;
    }) {
      return client.api<{ expense: ExpenseItem; journal: unknown }>("/accounting/expenses", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    profitAndLoss(from: string, to: string, outletId?: string) {
      const q = new URLSearchParams({ from, to });
      if (outletId) q.set("outletId", outletId);
      return client.api<ProfitAndLossReport>(`/accounting/reports/profit-and-loss?${q.toString()}`);
    },

    balanceSheet(asOf?: string, outletId?: string) {
      const q = new URLSearchParams();
      if (asOf) q.set("asOf", asOf);
      if (outletId) q.set("outletId", outletId);
      const qs = q.toString();
      return client.api<BalanceSheetReport>(`/accounting/reports/balance-sheet${qs ? `?${qs}` : ""}`);
    },

    ownerCapital(body: {
      amount: number;
      outletId?: string;
      paymentMethod?: string;
      description?: string;
      idempotencyKey?: string;
    }) {
      return client.api<unknown>("/accounting/owner-capital", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    ownerDrawing(body: {
      amount: number;
      outletId?: string;
      paymentMethod?: string;
      description?: string;
      idempotencyKey?: string;
    }) {
      return client.api<unknown>("/accounting/owner-drawing", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    supplierPayment(body: {
      outletId: string;
      supplierId: string;
      purchaseInvoiceId?: string;
      amount: number;
      paymentMethod: string;
      paymentDate?: string;
      reference?: string;
    }) {
      return client.api<unknown>("/accounting/supplier-payments", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
  };
}
