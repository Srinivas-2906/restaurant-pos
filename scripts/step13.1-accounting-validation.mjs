/**
 * Step 13.1 — comprehensive accounting E2E validation
 * Run: node scripts/step13.1-accounting-validation.mjs
 */
const BASE = process.env.API_BASE ?? "http://localhost:4000/api";
const PASSWORD = "password123";

const evidence = { tests: [], metrics: {} };
let pass = 0;
let fail = 0;

function record(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  evidence.tests.push({ name, pass: ok, detail });
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
    err.body = body;
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

async function opPin(terminalAuth, code, pin) {
  const staff = await api("/operational/terminals/me/eligible-staff", {
    headers: { Authorization: terminalAuth },
  });
  const emp = staff.find((s) => s.employeeCode === code);
  if (!emp) throw new Error(`Staff ${code} not found`);
  return api("/operational/pin-login", {
    method: "POST",
    headers: { Authorization: terminalAuth },
    body: JSON.stringify({ staffProfileId: emp.id, pin }),
  });
}

async function menuItem(headers, outletId, name) {
  const menu = await api(`/outlets/${outletId}/menu`, { headers });
  for (const m of menu) {
    for (const cat of m.categories ?? []) {
      const item = (cat.items ?? []).find((i) => i.name.includes(name));
      if (item) return item;
    }
  }
  return null;
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
    return floor.tables.find((t) => t.status === "free") ?? null;
  }
  for (const fp of floor.floorPlans ?? []) {
    const free = (fp.tables ?? []).find((t) => t.status === "free");
    if (free) return free;
  }
  return null;
}

async function ingredientByName(headers, outletId, name) {
  const items = await api(`/inventory/outlets/${outletId}/ingredients`, { headers });
  return items.find((i) => i.name === name);
}

async function supplierByName(headers, outletId, name) {
  const items = await api(`/inventory/outlets/${outletId}/suppliers`, { headers });
  return items.find((i) => i.name.includes(name));
}

function sumLines(entry, side) {
  return (entry.lines ?? []).reduce((s, l) => s + Number(l[side] ?? 0), 0);
}

async function settleOrder(posHeaders, ownerHeaders, outletId, biryani, method, discount = 0, settleHeaders = posHeaders) {
  const table = await freeTable(ownerHeaders, outletId);
  if (!table) throw new Error("No free table available");
  const created = await api("/orders", {
    method: "POST",
    headers: posHeaders,
    body: JSON.stringify({
      outletId,
      tableId: table.id,
      type: "dine_in",
      source: "pos",
    }),
  });
  await api(`/orders/${created.id}/items`, {
    method: "POST",
    headers: posHeaders,
    body: JSON.stringify({ menuItemId: biryani.id, quantity: 1 }),
  });
  const order = await api(`/orders/${created.id}`, { headers: ownerHeaders });
  await api(`/orders/${order.id}/kot`, { method: "POST", headers: posHeaders });
  const subtotal = Number(order.subtotal ?? 0);
  const tax = Number(order.taxAmount ?? 0);
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(tax * (subtotal > 0 ? taxable / subtotal : 0) * 100) / 100;
  const paymentAmount = Math.round((taxable + taxAmount) * 100) / 100;
  const settleBody = {
    payments: [{ method, amount: discount > 0 ? paymentAmount : Number(order.totalAmount) }],
  };
  if (discount > 0) settleBody.discountAmount = discount;
  const settled = await api(`/orders/${order.id}/settle`, {
    method: "POST",
    headers: settleHeaders,
    body: JSON.stringify(settleBody),
  });
  return { order, settled };
}

async function main() {
  console.log("=== Step 13.1 Accounting Validation ===");

  // Health
  try {
    const health = await api("/health");
    record("Environment: API health", health.status === "ok" || !!health, JSON.stringify(health));
  } catch (e) {
    record("Environment: API health", false, e.message);
    process.exit(1);
  }

  const owner = await login("owner@kaanafoods.in");
  const ownerHeaders = { Authorization: `Bearer ${owner.accessToken}` };
  const demoOutlet = await resolveDemoOutlet(ownerHeaders);
  const outletId = demoOutlet.id;
  const orgId = demoOutlet.brand?.organizationId ?? "cmselugbk0000u978y0qjuzqq";

  // Opening / COA
  const accounts = await api("/accounting/accounts", { headers: ownerHeaders });
  record("Opening: COA count = 23", accounts.length === 23, `count=${accounts.length}`);

  const tb0 = await api(`/accounting/reports/trial-balance?outletId=${outletId}`, { headers: ownerHeaders });
  const invRow = tb0.rows.find((r) => r.accountCode === "1200");
  const obeRow = tb0.rows.find((r) => r.accountCode === "3200");
  evidence.metrics.opening = {
    inventoryAsset: invRow ? invRow.closingDebit - invRow.closingCredit : 0,
    openingEquity: obeRow ? obeRow.closingCredit - obeRow.closingDebit : 0,
    tbDebits: tb0.totalDebits,
    tbCredits: tb0.totalCredits,
  };
  record("Opening: Inventory Asset > 0", evidence.metrics.opening.inventoryAsset > 0, String(evidence.metrics.opening.inventoryAsset));
  record("Opening: TB balanced", tb0.ok, `D=${tb0.totalDebits} C=${tb0.totalCredits}`);

  const poRecEntries = (await api(`/accounting/entries?limit=200`, { headers: ownerHeaders })).filter(
    (e) => e.reference?.includes("PO-REC") || e.description?.includes("PO-REC"),
  );
  const poOpenEntries = (await api(`/accounting/entries?limit=200`, { headers: ownerHeaders })).filter(
    (e) => e.reference?.includes("PO-OPEN") || e.description?.includes("PO-OPEN"),
  );
  record("PO-REC-001: no duplicate GL", poRecEntries.length === 0, `journals=${poRecEntries.length}`);
  record("PO-OPEN-001: no GL", poOpenEntries.length === 0, `journals=${poOpenEntries.length}`);

  const terminals = await api(`/terminals?outletId=${outletId}`, { headers: ownerHeaders });
  const pos = terminals.find((t) => t.code === "POS-01");
  const termAuth = `Terminal ${pos.id}:kaana-dev-pos-01-secret`;
  const cashier = await opPin(termAuth, "EMP001", "1111");
  const posHeaders = { Authorization: `Bearer ${cashier.accessToken}`, "X-Terminal-Auth": termAuth };
  const biryani = await menuItem(ownerHeaders, outletId, "Chicken Biryani");

  // Cash sale
  let cashOrderId;
  try {
    const { order, settled } = await settleOrder(posHeaders, ownerHeaders, outletId, biryani, "cash");
    cashOrderId = order.id;
    const invoice = settled.invoice;
    const payments = await api(`/orders/${order.id}`, { headers: ownerHeaders });
    const entries = await api(`/accounting/entries?outletId=${outletId}&limit=50`, { headers: ownerHeaders });
    const salesJe = entries.filter((e) => e.sourceEvent === "order_settlement" && e.sourceId === order.id);
    const cogsJe = entries.filter((e) => e.sourceEvent === "order_cogs" && e.sourceId === order.id);
    const salesDebits = sumLines(salesJe[0], "debit");
    const salesCredits = sumLines(salesJe[0], "credit");
    evidence.metrics.cashSale = {
      orderId: order.id,
      invoiceId: invoice?.id,
      salesJournalId: salesJe[0]?.id,
      cogsJournalId: cogsJe[0]?.id,
      invoiceTotal: Number(invoice?.totalAmount),
      salesDebits,
      salesCredits,
      revenue: Number(invoice?.taxableAmount),
      cgst: Number(invoice?.cgstAmount),
      sgst: Number(invoice?.sgstAmount),
    };
    record("Cash sale: one sales journal", salesJe.length === 1, salesJe[0]?.id);
    record("Cash sale: debits=credits", Math.abs(salesDebits - salesCredits) < 0.01);
    record("Cash sale: payment=invoice", Math.abs(salesDebits - Number(invoice.totalAmount)) < 0.01);
    record("Cash sale: COGS journal", cogsJe.length >= 1, cogsJe[0]?.id);
    await api(`/orders/${order.id}/settle`, {
      method: "POST",
      headers: posHeaders,
      body: JSON.stringify({ payments: [{ method: "cash", amount: Number((await api(`/orders/${order.id}`, { headers: ownerHeaders })).totalAmount) }] }),
    });
    const entries2 = await api(`/accounting/entries?outletId=${outletId}&limit=50`, { headers: ownerHeaders });
    record("Cash sale: idempotent", entries2.filter((e) => e.sourceEvent === "order_settlement" && e.sourceId === order.id).length === 1);
  } catch (e) {
    record("Cash sale", false, e.message);
  }

  // UPI sale
  try {
    const { order, settled } = await settleOrder(posHeaders, ownerHeaders, outletId, biryani, "upi");
    const ledger = await api(`/accounting/ledger/1020?outletId=${outletId}`, { headers: ownerHeaders });
    record("UPI sale: UPI clearing used", ledger.length > 0, `lines=${ledger.length}`);
    evidence.metrics.upiSale = { orderId: order.id, invoiceTotal: Number(settled.invoice?.totalAmount) };
  } catch (e) {
    record("UPI sale", false, e.message);
  }

  // Card sale
  try {
    const { order, settled } = await settleOrder(posHeaders, ownerHeaders, outletId, biryani, "card");
    const ledger = await api(`/accounting/ledger/1030?outletId=${outletId}`, { headers: ownerHeaders });
    record("Card sale: Card clearing used", ledger.length > 0);
    evidence.metrics.cardSale = { orderId: order.id, invoiceTotal: Number(settled.invoice?.totalAmount) };
  } catch (e) {
    record("Card sale", false, e.message);
  }

  // Discount
  try {
    const discount = 20;
    const { order, settled } = await settleOrder(posHeaders, ownerHeaders, outletId, biryani, "cash", discount, ownerHeaders);
    const inv = settled.invoice;
    const entries = await api(`/accounting/entries?outletId=${outletId}&limit=20`, { headers: ownerHeaders });
    const salesJe = entries.find((e) => e.sourceEvent === "order_settlement" && e.sourceId === order.id);
    const debits = sumLines(salesJe, "debit");
    const credits = sumLines(salesJe, "credit");
    const paymentAmount = Number(inv.totalAmount);
    evidence.metrics.discount = {
      subtotal: Number(order.subtotal),
      discount,
      taxableAmount: Number(inv.taxableAmount),
      cgst: Number(inv.cgstAmount),
      sgst: Number(inv.sgstAmount),
      grandTotal: Number(inv.totalAmount),
      paymentAmount,
      journalDebit: debits,
      journalCredits: credits,
    };
    const ok =
      Math.abs(Number(inv.taxableAmount) - (Number(order.subtotal) - discount)) < 0.01 &&
      Math.abs(debits - Number(inv.totalAmount)) < 0.01 &&
      Math.abs(credits - Number(inv.totalAmount)) < 0.01 &&
      Math.abs(debits - credits) < 0.01;
    record("Discount: invoice/journal reconcile", ok, JSON.stringify(evidence.metrics.discount));
  } catch (e) {
    record("Discount", false, e.message);
  }

  // GRN
  let grnId, grnValue, supplierBillId;
  try {
    const chicken = await ingredientByName(ownerHeaders, outletId, "Chicken");
    const supplier = await supplierByName(ownerHeaders, outletId, "Fresh Poultry");
    const stockBefore = Number(chicken.currentStock);
    const po = await api(`/inventory/outlets/${outletId}/purchase-orders`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        supplierId: supplier.id,
        items: [{ ingredientId: chicken.id, quantity: 5, unitPrice: 280 }],
      }),
    });
    await api(`/inventory/purchase-orders/${po.id}/send`, { method: "POST", headers: ownerHeaders });
    const grnIdem = "e2e-grn-step13-1";
    await api(`/inventory/purchase-orders/${po.id}/receive`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        idempotencyKey: grnIdem,
        lines: [{ poItemId: po.items[0].id, receivedQty: 5 }],
      }),
    });
    const grns = await api(`/inventory/outlets/${outletId}/goods-receipts`, { headers: ownerHeaders });
    const grn = grns.find((g) => g.purchaseOrderId === po.id);
    grnId = grn?.id;
    grnValue = 5 * 280;
    const chickenAfter = await ingredientByName(ownerHeaders, outletId, "Chicken");
    record("GRN: stock +5", Number(chickenAfter.currentStock) - stockBefore === 5, `before=${stockBefore} after=${chickenAfter.currentStock}`);
    const grni = await api(`/accounting/ledger/2100?outletId=${outletId}`, { headers: ownerHeaders });
    record("GRN: GRNI posted", grni.length > 0);
    const journalsBefore = (await api(`/accounting/entries?limit=100`, { headers: ownerHeaders })).filter(
      (e) => e.sourceEvent === "goods_receipt" && e.sourceId === grnId,
    ).length;
    await api(`/inventory/purchase-orders/${po.id}/receive`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ idempotencyKey: grnIdem }),
    });
    const grnJournals = (await api(`/accounting/entries?limit=100`, { headers: ownerHeaders })).filter(
      (e) => e.sourceEvent === "goods_receipt" && e.sourceId === grnId,
    );
    record("GRN: idempotent", grnJournals.length === journalsBefore, `count=${grnJournals.length}`);
    evidence.metrics.grn = { grnId, grnNumber: grn?.grnNumber, value: grnValue };
  } catch (e) {
    record("GRN", false, e.message);
  }

  // Supplier bill + partial payment
  try {
    const chicken = await ingredientByName(ownerHeaders, outletId, "Chicken");
    const supplier = await supplierByName(ownerHeaders, outletId, "Fresh Poultry");
    const bill = await api(`/inventory/outlets/${outletId}/purchase-invoices`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        supplierId: supplier.id,
        goodsReceiptId: grnId,
        invoiceNumber: `BILL-E2E-${Date.now()}`,
        invoiceDate: new Date().toISOString(),
        taxableValue: grnValue,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalAmount: grnValue,
      }),
    });
    supplierBillId = bill.id;
    const apLedger = await api(`/accounting/ledger/2000?outletId=${outletId}`, { headers: ownerHeaders });
    record("Supplier bill: AP posted", apLedger.length > 0);
    const partial = Math.round(grnValue / 2);
    await api("/accounting/supplier-payments", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        outletId,
        supplierId: supplier.id,
        purchaseInvoiceId: bill.id,
        amount: partial,
        paymentMethod: "cash",
      }),
    });
    let overRejected = false;
    try {
      await api("/accounting/supplier-payments", {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({
          outletId,
          supplierId: supplier.id,
          purchaseInvoiceId: bill.id,
          amount: grnValue,
          paymentMethod: "cash",
        }),
      });
    } catch (e) {
      overRejected = e.status === 400;
    }
    record("Supplier payment: overpayment rejected", overRejected);
    const apTb = (await api(`/accounting/reports/trial-balance?outletId=${outletId}`, { headers: ownerHeaders })).rows.find(
      (r) => r.accountCode === "2000",
    );
    const apGl = apTb ? apTb.closingCredit - apTb.closingDebit : 0;
    evidence.metrics.ap = { billTotal: grnValue, partialPaid: partial, apGl, outstandingExpected: grnValue - partial };
    record("AP reconciliation", Math.abs(apGl - (grnValue - partial)) < 1, `GL=${apGl} expected=${grnValue - partial}`);
  } catch (e) {
    record("Supplier bill/payment", false, e.message);
  }

  // Wastage
  try {
    const chicken = await ingredientByName(ownerHeaders, outletId, "Chicken");
    await api(`/inventory/outlets/${outletId}/wastage`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ ingredientId: chicken.id, quantity: 0.5, reason: "Step13.1 wastage" }),
    });
    const wasteLedger = await api(`/accounting/ledger/5100?outletId=${outletId}`, { headers: ownerHeaders });
    record("Wastage: expense posted", wasteLedger.length > 0);
  } catch (e) {
    record("Wastage", false, e.message);
  }

  // Stock count adjustment
  try {
    const chicken = await ingredientByName(ownerHeaders, outletId, "Chicken");
    const count = await api(`/inventory/outlets/${outletId}/stock-counts`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ countType: "full", notes: "Step13.1 count" }),
    });
    const counts = await api(`/inventory/outlets/${outletId}/stock-counts`, { headers: ownerHeaders });
    const full = counts.find((c) => c.id === count.id) ?? count;
    const line = (full.lines ?? count.lines ?? []).find((l) => l.ingredientId === chicken.id);
    if (!line) throw new Error("Stock count line for chicken not found");
    await api(`/inventory/stock-counts/${count.id}/lines/${line.id}`, {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({ physicalStock: Number(chicken.currentStock) - 0.25, reason: "E2E variance" }),
    });
    await api(`/inventory/stock-counts/${count.id}/approve`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({}),
    });
    const adjLedger = await api(`/accounting/ledger/5200?outletId=${outletId}`, { headers: ownerHeaders });
    record("Stock count: adjustment journal", adjLedger.length > 0);
  } catch (e) {
    record("Stock count adjustment", false, e.message);
  }

  // Cancelled order
  try {
    const table = await freeTable(ownerHeaders, outletId);
    const created = await api("/orders", {
      method: "POST",
      headers: posHeaders,
      body: JSON.stringify({ outletId, tableId: table.id, type: "dine_in", source: "pos" }),
    });
    await api(`/orders/${created.id}/items`, {
      method: "POST",
      headers: posHeaders,
      body: JSON.stringify({ menuItemId: biryani.id, quantity: 1 }),
    });
    const order = await api(`/orders/${created.id}`, { headers: ownerHeaders });
    await api(`/orders/${order.id}/kot`, { method: "POST", headers: posHeaders });
    await api(`/orders/${order.id}/cancel`, { method: "POST", headers: posHeaders, body: JSON.stringify({}) });
    const entries = await api(`/accounting/entries?limit=100`, { headers: ownerHeaders });
    const bad = entries.filter((e) => e.sourceId === order.id);
    record("Cancelled order: no financial posting", bad.length === 0, `journals=${bad.length}`);
  } catch (e) {
    record("Cancelled order", false, e.message);
  }

  // Capital / drawing / expense
  try {
    await api("/accounting/owner-capital", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ amount: 50000, outletId, paymentMethod: "cash", idempotencyKey: "e2e-cap-50000-v2" }),
    });
    await api("/accounting/owner-drawing", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ amount: 5000, outletId, paymentMethod: "cash", idempotencyKey: "e2e-draw-5000-v2" }),
    });
    await api("/accounting/expenses", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ outletId, amount: 1000, description: "Cleaning", paymentMethod: "cash" }),
    });
    record("Capital/drawing/expense posted", true);
  } catch (e) {
    record("Capital/drawing/expense", false, e.message);
  }

  // Reports
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const toDate = new Date();
  toDate.setHours(23, 59, 59, 999);
  const to = toDate.toISOString();
  const tb = await api(`/accounting/reports/trial-balance?outletId=${outletId}`, { headers: ownerHeaders });
  const pl = await api(`/accounting/reports/profit-and-loss?from=${from}&to=${to}&outletId=${outletId}`, { headers: ownerHeaders });
  const bs = await api(`/accounting/reports/balance-sheet?outletId=${outletId}`, { headers: ownerHeaders });
  const rec = await api(`/accounting/reconcile?outletId=${outletId}`, { headers: ownerHeaders });
  const invRec = await api(`/inventory/outlets/${outletId}/reconcile`, { headers: ownerHeaders });

  evidence.metrics.trialBalance = {
    totalDebits: tb.totalDebits,
    totalCredits: tb.totalCredits,
    difference: tb.totalDebits - tb.totalCredits,
    ok: tb.ok,
  };
  evidence.metrics.pl = pl;
  evidence.metrics.balanceSheet = {
    totalAssets: bs.totalAssets,
    totalLiabilities: bs.totalLiabilities,
    totalEquity: bs.totalEquity,
    retainedEarnings: bs.retainedEarnings,
    liabilitiesPlusEquity: bs.equation.liabilitiesPlusEquity,
    difference: bs.totalAssets - bs.equation.liabilitiesPlusEquity,
    ok: bs.ok,
  };
  evidence.metrics.inventoryReconcile = rec.inventory;
  evidence.metrics.stockReconcile = invRec;
  evidence.metrics.journalIntegrity = rec.journals;

  record("Trial balance: difference=0", Math.abs(evidence.metrics.trialBalance.difference) < 0.01, `diff=${evidence.metrics.trialBalance.difference}`);
  record("Balance sheet: A=L+E", bs.ok, `diff=${evidence.metrics.balanceSheet.difference}`);
  record("Inventory GL reconcile", rec.ok, `delta=${rec.inventory.delta}`);
  record("Stock ledger reconcile", invRec.ok, `mismatches=${invRec.mismatchCount}`);
  record("Journal integrity", rec.journals.count === 0, `unbalanced=${rec.journals.count}/${rec.journals.total}`);

  // Security
  try {
    await api("/accounting/accounts", { headers: posHeaders });
    record("Security: cashier denied", false, "unexpected allow");
  } catch (e) {
    record("Security: cashier denied accounting", e.status === 401 || e.status === 403, `status=${e.status}`);
  }

  // Finance disabled but posting continues
  try {
    const admin = await login("admin@kaanafoods.in");
    await api(`/platform/tenants/${orgId}/config`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ moduleOverrides: [{ moduleKey: "finance", enabled: false }] }),
    });
    let financeDenied = false;
    try {
      await api("/accounting/accounts", { headers: ownerHeaders });
    } catch (e) {
      financeDenied = e.status === 403;
    }
    const { order } = await settleOrder(posHeaders, ownerHeaders, outletId, biryani, "cash");
    await api(`/platform/tenants/${orgId}/config`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      body: JSON.stringify({ moduleOverrides: [{ moduleKey: "finance", enabled: true }] }),
    });
    const hasJournal = (await api(`/accounting/entries?limit=50`, { headers: ownerHeaders })).some(
      (e) => e.sourceId === order.id && e.sourceEvent === "order_settlement",
    );
    record("Finance disabled: API denied", financeDenied);
    record("Finance disabled: sale still posts GL", hasJournal, `order=${order.id}`);
  } catch (e) {
    record("Finance capability test", false, e.message);
  }

  console.log(`\n=== Summary: ${pass}/${pass + fail} PASS ===`);
  console.log(JSON.stringify(evidence, null, 2));
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
