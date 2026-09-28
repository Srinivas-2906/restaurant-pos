/**
 * Step 14 — Money & Financial Operations E2E
 * Run: node scripts/step14-money-e2e.mjs
 */
const BASE = process.env.API_BASE ?? "http://localhost:4000/api";
const PASSWORD = "password123";

let pass = 0;
let fail = 0;

function record(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function api(path, opts = {}) {
  const { headers: optHeaders, ...rest } = opts;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: { "Content-Type": "application/json", ...(optHeaders ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = new Error(typeof body === "object" ? body.message ?? JSON.stringify(body) : text);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function login(email) {
  return api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD }),
  });
}

async function resolveDemoOutlet(headers) {
  const outlets = await api("/outlets", { headers });
  const list = Array.isArray(outlets) ? outlets : outlets?.value ?? [];
  const main = list.find((o) => o.code === "MAIN-001");
  if (!main) throw new Error("MAIN-001 demo outlet not found");
  return main;
}

async function freeTable(headers, outletId) {
  const floor = await api(`/outlets/${outletId}/floor`, { headers });
  if (!floor) return null;
  if (Array.isArray(floor.tables)) {
    return floor.tables.find((t) => t.status === "free") ?? floor.tables[0] ?? null;
  }
  for (const fp of floor.floorPlans ?? []) {
    const free = (fp.tables ?? []).find((t) => t.status === "free");
    if (free) return free;
  }
  return null;
}

async function settleOrder(headers, outletId, method) {
  const table = await freeTable(headers, outletId);
  const menu = await api(`/outlets/${outletId}/menu`, { headers });
  let menuItem = null;
  for (const m of menu) {
    for (const cat of m.categories ?? []) {
      menuItem = (cat.items ?? []).find((i) => i.isAvailable);
      if (menuItem) break;
    }
    if (menuItem) break;
  }
  if (!menuItem) throw new Error("No menu item");

  const created = await api("/orders", {
    method: "POST",
    headers,
    body: JSON.stringify({
      outletId,
      tableId: table?.id,
      type: "dine_in",
      source: "pos",
    }),
  });
  await api(`/orders/${created.id}/items`, {
    method: "POST",
    headers,
    body: JSON.stringify({ menuItemId: menuItem.id, quantity: 1 }),
  });
  const order = await api(`/orders/${created.id}`, { headers });
  await api(`/orders/${order.id}/kot`, { method: "POST", headers });
  const settled = await api(`/orders/${order.id}/settle`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      payments: [{ method, amount: Number(order.totalAmount) }],
    }),
  });
  return settled;
}

async function main() {
  console.log("=== Step 14 Money E2E ===");

  const owner = await login("owner@kaanafoods.in");
  const headers = { Authorization: `Bearer ${owner.accessToken}` };
  const outlet = await resolveDemoOutlet(headers);

  record("Owner login", !!owner.accessToken);
  record("Resolve MAIN-001 outlet", outlet.code === "MAIN-001", outlet.id);

  await api("/accounting/bootstrap", { method: "POST", headers });

  const capital = await api("/accounting/owner-capital", {
    method: "POST",
    headers,
    body: JSON.stringify({
      amount: 50000,
      outletId: outlet.id,
      paymentMethod: "cash",
      idempotencyKey: `step14-capital-${Date.now()}`,
    }),
  });
  record("Owner capital ₹50,000", !!capital);

  const cashSale = await settleOrder(headers, outlet.id, "cash");
  const upiSale = await settleOrder(headers, outlet.id, "upi");
  const cardSale = await settleOrder(headers, outlet.id, "card");
  record("Cash sale settled", !!cashSale.order);
  record("UPI sale settled", !!upiSale.order);
  record("Card sale settled", !!cardSale.order);

  const expense = await api("/accounting/expenses", {
    method: "POST",
    headers,
    body: JSON.stringify({
      outletId: outlet.id,
      amount: 1000,
      description: "Step14 test expense",
      paymentMethod: "cash",
      expenseAccountCode: "5300",
    }),
  });
  record("Operating expense ₹1,000", !!expense.expense);

  const summary = await api(`/accounting/money-summary?period=today&outletId=${outlet.id}`, { headers });
  record("Money summary loads", summary != null);
  record("Cash in hand reflects capital not just sales", summary.balances.cashInHand >= 40000, `cash=${summary.balances.cashInHand}`);
  record("Sales from GL", summary.sales > 0, `sales=${summary.sales}`);
  record("Payment breakdown cash", summary.paymentBreakdown.cash >= 100, `cashSales=${summary.paymentBreakdown.cash}`);
  record("Payment breakdown UPI", summary.paymentBreakdown.upi >= 100, `upi=${summary.paymentBreakdown.upi}`);
  record("Payment breakdown card", summary.paymentBreakdown.card >= 100, `card=${summary.paymentBreakdown.card}`);
  record("Profit ≠ cash", summary.profit !== summary.balances.cashInHand);
  record("Integrity status present", typeof summary.integrity.ok === "boolean");

  const plMobile = summary.profitSummary;
  const plApi = await api(
    `/accounting/reports/profit-and-loss?from=${encodeURIComponent(summary.period.from)}&to=${encodeURIComponent(summary.period.to)}&outletId=${outlet.id}`,
    { headers },
  );
  record(
    "Mobile P&L parity with API",
    Math.abs(plMobile.netProfit - plApi.netProfit) < 0.02,
    `mobile=${plMobile.netProfit} api=${plApi.netProfit}`,
  );

  const bs = await api(`/accounting/reports/balance-sheet?outletId=${outlet.id}`, { headers });
  const eqOk = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)) < 0.05;
  record("Balance sheet equation", eqOk);

  const reconcile = await api(`/accounting/reconcile?outletId=${outlet.id}`, { headers });
  record("Accounting reconciliation", reconcile.ok === true);

  const dues = await api(`/accounting/supplier-dues?outletId=${outlet.id}`, { headers });
  record("Supplier dues endpoint", typeof dues.totalOutstanding === "number");

  const activity = await api(`/accounting/money/activity?outletId=${outlet.id}&limit=20`, { headers });
  record("Money activity", Array.isArray(activity) && activity.length > 0);

  const reconcileMissing = await api("/accounting/posting-jobs/reconcile-missing", {
    method: "POST",
    headers,
  });
  record("Missing posting recovery scan", reconcileMissing != null);

  const cashBeforeDrawing = (await api(`/accounting/money-summary?period=today&outletId=${outlet.id}`, { headers }))
    .balances.cashInHand;
  const profitBeforeDrawing = (await api(`/accounting/money-summary?period=today&outletId=${outlet.id}`, { headers }))
    .profit;

  const drawing = await api("/accounting/owner-drawing", {
    method: "POST",
    headers,
    body: JSON.stringify({
      amount: 500,
      outletId: outlet.id,
      paymentMethod: "cash",
      idempotencyKey: `step14-draw-${Date.now()}`,
    }),
  });
  record("Owner drawing recorded", !!drawing);

  const summaryAfter = await api(`/accounting/money-summary?period=today&outletId=${outlet.id}`, { headers });
  record(
    "Drawing reduces cash",
    summaryAfter.balances.cashInHand < cashBeforeDrawing - 400,
    `before=${cashBeforeDrawing} after=${summaryAfter.balances.cashInHand}`,
  );
  record(
    "Drawing does not reduce profit as expense",
    Math.abs(summaryAfter.profit - profitBeforeDrawing) < 1,
    `profitBefore=${profitBeforeDrawing} profitAfter=${summaryAfter.profit}`,
  );

  console.log(`\n=== ${pass}/${pass + fail} PASS ===`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
