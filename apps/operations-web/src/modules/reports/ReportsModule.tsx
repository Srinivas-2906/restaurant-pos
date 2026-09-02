"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getOutletId, daysAgoRange } from "@/lib/api";
import { downloadCombinedCsv, downloadCsv, downloadJson, formatReportDate, type CsvSection } from "@/lib/reportExport";
import { ReportDownloadButton, ReportSection } from "@/components/reports/ReportSection";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@kaana/ui";

const REPORT_SECTIONS = [
  { id: "sales-daily", label: "Daily sales" },
  { id: "sales-breakdown", label: "Sales breakdown" },
  { id: "top-items", label: "Item sales" },
  { id: "inventory", label: "Inventory" },
  { id: "wastage", label: "Wastage" },
  { id: "food-cost", label: "Food cost" },
  { id: "consumption", label: "Consumption" },
  { id: "suppliers", label: "Suppliers" },
  { id: "reconciliation", label: "Reconciliation" },
  { id: "outlet-comparison", label: "Outlets" },
  { id: "gst", label: "GST" },
] as const;

export function ReportsModule() {
  const outletId = getOutletId();
  const [periodDays, setPeriodDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [sales, setSales] = useState<{
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    bySource?: Record<string, number>;
    byPayment?: Record<string, number>;
  } | null>(null);
  const [dailySales, setDailySales] = useState<Array<{ date: string; revenue: number; orders: number }>>([]);
  const [comparison, setComparison] = useState<
    Array<{ outletName?: string; totalRevenue?: number; totalOrders?: number; avgOrderValue?: number }>
  >([]);
  const [inventory, setInventory] = useState<
    Array<{
      id: string;
      name: string;
      unit: string;
      category?: string;
      currentStock?: number;
      committed?: number;
      available?: number;
      reorderLevel?: number;
      targetStock?: number;
      isLowStock?: boolean;
      weightedAverageCost?: number;
      value?: number;
    }>
  >([]);
  const [wastage, setWastage] = useState<
    Array<{
      id: string;
      quantity: number | string;
      totalValue?: number | string;
      ingredient?: { name: string; unit?: string };
      createdAt: string;
      notes?: string | null;
    }>
  >([]);
  const [foodCost, setFoodCost] = useState<{
    revenue: number;
    actualConsumption: number;
    theoreticalConsumption: number;
    variance: number;
    foodCostPct: number;
    theoreticalFoodCostPct: number;
    purchases: number;
  } | null>(null);
  const [consumption, setConsumption] = useState<Array<{ name: string; unit: string; quantity: number; value: number }>>([]);
  const [suppliers, setSuppliers] = useState<
    Array<{
      id: string;
      name: string;
      onTimeDeliveryPct: number;
      rejectionRate: number;
      avgPriceVariance?: number;
      outstandingAmount?: number;
      totalPurchases: number;
      openPOs: number;
      recentReceipts?: number;
      lastPurchaseAt?: string | null;
    }>
  >([]);
  const [topItems, setTopItems] = useState<Array<{ name: string; quantity: number; revenue: number }>>([]);
  const [reconciliation, setReconciliation] = useState<{
    totalCollected: number;
    expectedSettlement: number;
    variance: number;
    orderCount?: number;
    byMethod?: Record<string, number>;
  } | null>(null);
  const [gst, setGst] = useState<{
    totalInvoices?: number;
    totalTaxable?: number;
    totalCGST?: number;
    totalSGST?: number;
    totalAmount?: number;
    invoices?: Array<{
      invoiceNumber: string;
      date: string;
      gstin?: string;
      taxableAmount: number;
      cgst: number;
      sgst: number;
      total: number;
    }>;
  } | null>(null);

  const range = useMemo(() => daysAgoRange(periodDays), [periodDays]);
  const periodLabel = `Last ${periodDays} days`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      const { from, to } = range;

      try {
        const requests: Promise<unknown>[] = [
          api<typeof comparison>(`/reports/outlets/comparison?from=${from}&to=${to}`),
        ];

        if (outletId) {
          requests.push(
            api<typeof sales>(`/reports/sales?outletId=${outletId}&from=${from}&to=${to}`),
            api<typeof dailySales>(`/reports/sales/daily?outletId=${outletId}&from=${from}&to=${to}`),
            api<typeof inventory>(`/reports/inventory?outletId=${outletId}`),
            api<typeof wastage>(`/reports/wastage?outletId=${outletId}&from=${from}&to=${to}`),
            api<typeof foodCost>(`/reports/inventory/food-cost?outletId=${outletId}&from=${from}&to=${to}`),
            api<typeof consumption>(`/reports/inventory/consumption?outletId=${outletId}&from=${from}&to=${to}`),
            api<typeof suppliers>(`/reports/inventory/suppliers?outletId=${outletId}`),
            api<typeof topItems>(`/reports/items?outletId=${outletId}&from=${from}&to=${to}`),
            api<typeof reconciliation>(`/reports/reconciliation?outletId=${outletId}&from=${from}&to=${to}`),
            api<typeof gst>(`/reports/gst/export?outletId=${outletId}&from=${from}&to=${to}`),
          );
        }

        const results = await Promise.allSettled(requests);
        if (cancelled) return;

        if (results[0].status === "fulfilled") setComparison(results[0].value as typeof comparison);
        else setComparison([]);

        if (outletId) {
          const [, salesR, dailyR, invR, wastR, fcR, consR, supR, itemsR, reconR, gstR] = results;
          if (salesR.status === "fulfilled") setSales(salesR.value as typeof sales);
          if (dailyR.status === "fulfilled") setDailySales(dailyR.value as typeof dailySales);
          if (invR.status === "fulfilled") setInventory(invR.value as typeof inventory);
          else setInventory([]);
          if (wastR.status === "fulfilled") setWastage(wastR.value as typeof wastage);
          else setWastage([]);
          if (fcR.status === "fulfilled") setFoodCost(fcR.value as typeof foodCost);
          if (consR.status === "fulfilled") setConsumption(consR.value as typeof consumption);
          if (supR.status === "fulfilled") setSuppliers(supR.value as typeof suppliers);
          if (itemsR.status === "fulfilled") setTopItems(itemsR.value as typeof topItems);
          if (reconR.status === "fulfilled") setReconciliation(reconR.value as typeof reconciliation);
          if (gstR.status === "fulfilled") setGst(gstR.value as typeof gst);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [outletId, range]);

  const salesSourceRows = Object.entries(sales?.bySource ?? {}).map(([source, amount]) => ({
    id: source,
    source: source.replace(/_/g, " "),
    amount: Number(amount),
    amountFormatted: formatCurrency(Number(amount)),
  }));

  const salesPaymentRows = Object.entries(sales?.byPayment ?? {}).map(([method, amount]) => ({
    id: method,
    method,
    amount: Number(amount),
    amountFormatted: formatCurrency(Number(amount)),
  }));

  const dailySalesRows = dailySales.map((d) => ({
    id: d.date,
    date: new Date(d.date).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }),
    orders: d.orders,
    revenue: d.revenue,
    revenueFormatted: formatCurrency(d.revenue),
  }));

  const topItemRows = topItems.map((item, i) => ({
    id: item.name,
    rank: i + 1,
    name: item.name,
    quantity: item.quantity,
    revenue: item.revenue,
    revenueFormatted: formatCurrency(item.revenue),
  }));

  const inventoryRows = inventory.map((item) => ({
    ...item,
    isLowStockLabel: item.isLowStock ? "Yes" : "No",
    valueFormatted: formatCurrency(Number(item.value ?? 0)),
    costFormatted: formatCurrency(Number(item.weightedAverageCost ?? 0)),
  }));

  const wastageRows = wastage.map((w) => ({
    id: w.id,
    date: formatReportDate(w.createdAt),
    ingredient: w.ingredient?.name ?? "Unknown",
    quantity: Math.abs(Number(w.quantity)).toFixed(2),
    unit: w.ingredient?.unit ?? "",
    value: Number(w.totalValue ?? 0),
    valueFormatted: formatCurrency(Number(w.totalValue ?? 0)),
    notes: w.notes ?? "",
  }));

  const consumptionRows = consumption.map((row, i) => ({
    id: row.name,
    rank: i + 1,
    name: row.name,
    quantity: row.quantity.toFixed(2),
    unit: row.unit,
    value: row.value,
    valueFormatted: formatCurrency(row.value),
  }));

  const supplierRows = suppliers.map((s) => ({
    ...s,
    totalPurchasesFormatted: formatCurrency(s.totalPurchases),
    outstandingFormatted: formatCurrency(Number(s.outstandingAmount ?? 0)),
    lastPurchase: s.lastPurchaseAt ? formatReportDate(s.lastPurchaseAt) : "—",
  }));

  const comparisonRows = comparison.map((r, i) => ({
    id: r.outletName ?? `outlet-${i}`,
    outlet: r.outletName ?? "Outlet",
    orders: r.totalOrders ?? 0,
    revenue: Number(r.totalRevenue ?? 0),
    revenueFormatted: formatCurrency(Number(r.totalRevenue ?? 0)),
    aov: Number(r.avgOrderValue ?? 0),
    aovFormatted: formatCurrency(Number(r.avgOrderValue ?? 0)),
  }));

  const gstRows = (gst?.invoices ?? []).map((inv) => ({
    id: inv.invoiceNumber,
    invoiceNumber: inv.invoiceNumber,
    date: formatReportDate(inv.date),
    gstin: inv.gstin ?? "",
    taxable: Number(inv.taxableAmount),
    taxableFormatted: formatCurrency(Number(inv.taxableAmount)),
    cgst: Number(inv.cgst),
    cgstFormatted: formatCurrency(Number(inv.cgst)),
    sgst: Number(inv.sgst),
    sgstFormatted: formatCurrency(Number(inv.sgst)),
    total: Number(inv.total),
    totalFormatted: formatCurrency(Number(inv.total)),
  }));

  const reconciliationMethodRows = Object.entries(reconciliation?.byMethod ?? {}).map(([method, amount]) => ({
    id: method,
    method,
    amount: Number(amount),
    amountFormatted: formatCurrency(Number(amount)),
  }));

  function buildExportSections(): CsvSection[] {
    return [
      {
        title: `Daily Sales (${periodLabel})`,
        headers: ["Date", "Orders", "Revenue"],
        rows: dailySalesRows.map((r) => [r.date, r.orders, r.revenue]),
      },
      {
        title: "Sales by Source",
        headers: ["Source", "Revenue"],
        rows: salesSourceRows.map((r) => [r.source, r.amount]),
      },
      {
        title: "Sales by Payment Method",
        headers: ["Method", "Amount"],
        rows: salesPaymentRows.map((r) => [r.method, r.amount]),
      },
      {
        title: "Item Sales",
        headers: ["Rank", "Item", "Quantity", "Revenue"],
        rows: topItemRows.map((r) => [r.rank, r.name, r.quantity, r.revenue]),
      },
      {
        title: "Inventory",
        headers: ["Ingredient", "Category", "Unit", "Available", "Reorder Level", "Low Stock", "Unit Cost", "Stock Value"],
        rows: inventoryRows.map((r) => [
          r.name,
          r.category ?? "",
          r.unit,
          r.available ?? "",
          r.reorderLevel ?? "",
          r.isLowStockLabel,
          r.weightedAverageCost ?? "",
          r.value ?? "",
        ]),
      },
      {
        title: `Wastage (${periodLabel})`,
        headers: ["Date", "Ingredient", "Quantity", "Unit", "Value", "Notes"],
        rows: wastageRows.map((r) => [r.date, r.ingredient, r.quantity, r.unit, r.value, r.notes]),
      },
      {
        title: "Food Cost Summary",
        headers: ["Metric", "Value"],
        rows: foodCost
          ? [
              ["Revenue", foodCost.revenue],
              ["Actual consumption", foodCost.actualConsumption],
              ["Theoretical consumption", foodCost.theoreticalConsumption],
              ["Variance", foodCost.variance],
              ["Food cost %", foodCost.foodCostPct],
              ["Theoretical food cost %", foodCost.theoreticalFoodCostPct],
              ["Purchases", foodCost.purchases],
            ]
          : [],
      },
      {
        title: "Ingredient Consumption",
        headers: ["Rank", "Ingredient", "Quantity", "Unit", "Value"],
        rows: consumptionRows.map((r) => [r.rank, r.name, r.quantity, r.unit, r.value]),
      },
      {
        title: "Suppliers",
        headers: ["Supplier", "Total Purchases", "On-time %", "Rejection %", "Open POs", "Outstanding", "Last Purchase"],
        rows: supplierRows.map((r) => [
          r.name,
          r.totalPurchases,
          r.onTimeDeliveryPct,
          r.rejectionRate,
          r.openPOs,
          r.outstandingAmount ?? 0,
          r.lastPurchase,
        ]),
      },
      {
        title: "Payment Reconciliation",
        headers: ["Method", "Amount"],
        rows: reconciliationMethodRows.map((r) => [r.method, r.amount]),
      },
      {
        title: `Outlet Comparison (${periodLabel})`,
        headers: ["Outlet", "Orders", "Revenue", "Avg Order Value"],
        rows: comparisonRows.map((r) => [r.outlet, r.orders, r.revenue, r.aov]),
      },
      {
        title: "GST Invoices",
        headers: ["Invoice", "Date", "GSTIN", "Taxable", "CGST", "SGST", "Total"],
        rows: gstRows.map((r) => [r.invoiceNumber, r.date, r.gstin, r.taxable, r.cgst, r.sgst, r.total]),
      },
    ].filter((s) => s.rows.length > 0);
  }

  function exportAllCsv() {
    downloadCombinedCsv(`kaana-reports-${periodDays}d-${new Date().toISOString().slice(0, 10)}.csv`, buildExportSections());
  }

  function exportAllJson() {
    downloadJson(`kaana-reports-${periodDays}d-${new Date().toISOString().slice(0, 10)}.json`, {
      period: { days: periodDays, ...range },
      outletId,
      summary: {
        sales,
        foodCost,
        reconciliation,
        gstTotals: {
          totalInvoices: gst?.totalInvoices,
          totalTaxable: gst?.totalTaxable,
          totalCGST: gst?.totalCGST,
          totalSGST: gst?.totalSGST,
          totalAmount: gst?.totalAmount,
        },
      },
      dailySales,
      salesBySource: sales?.bySource,
      salesByPayment: sales?.byPayment,
      topItems,
      inventory,
      wastage,
      consumption,
      suppliers,
      outletComparison: comparison,
      gstInvoices: gst?.invoices,
    });
  }

  const lowStockCount = inventory.filter((i) => i.isLowStock).length;
  const inventoryValue = inventory.reduce((s, i) => s + Number(i.value ?? 0), 0);
  const wastageValue = wastage.reduce((s, w) => s + Number(w.totalValue ?? 0), 0);

  return (
    <PageContent>
      <PageHeader
        title="Reports"
        description="Full operational reports with CSV export for every section."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <ReportDownloadButton label="Export all CSV" onClick={exportAllCsv} disabled={loading || !outletId} />
            <ReportDownloadButton label="Export all JSON" onClick={exportAllJson} disabled={loading || !outletId} />
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!outletId && (
        <Panel className="mb-6">
          <EmptyState title="Select an outlet" description="Choose an outlet from the header to view outlet-specific reports." />
        </Panel>
      )}

      <nav className="mb-6 flex flex-wrap gap-2">
        {REPORT_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-700 hover:border-kaana hover:text-kaana"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Revenue" value={loading ? "—" : formatCurrency(Number(sales?.totalRevenue ?? 0))} loading={loading} />
        <MetricCard label="Orders" value={loading ? "—" : String(sales?.totalOrders ?? 0)} loading={loading} />
        <MetricCard label="Avg order value" value={loading ? "—" : formatCurrency(Number(sales?.avgOrderValue ?? 0))} loading={loading} />
        <MetricCard label="Food cost %" value={loading ? "—" : `${foodCost?.foodCostPct?.toFixed(1) ?? 0}%`} loading={loading} />
      </div>

      <div className="space-y-6">
        <ReportSection
          id="sales-daily"
          title="Daily sales"
          subtitle={periodLabel}
          filename={`daily-sales-${periodDays}d.csv`}
          loading={loading}
          columns={[
            { key: "date", label: "Date" },
            { key: "orders", label: "Orders", align: "right" },
            { key: "revenueFormatted", label: "Revenue", align: "right" },
          ]}
          rows={dailySalesRows}
          emptyTitle="No daily sales data"
        />

        <div className="grid lg:grid-cols-2 gap-6">
          <ReportSection
            id="sales-breakdown"
            title="Sales by source"
            subtitle={periodLabel}
            filename={`sales-by-source-${periodDays}d.csv`}
            loading={loading}
            columns={[
              { key: "source", label: "Source" },
              { key: "amountFormatted", label: "Revenue", align: "right" },
            ]}
            rows={salesSourceRows}
            emptyTitle="No source breakdown"
          />
          <ReportSection
            title="Sales by payment method"
            subtitle={periodLabel}
            filename={`sales-by-payment-${periodDays}d.csv`}
            loading={loading}
            columns={[
              { key: "method", label: "Method" },
              { key: "amountFormatted", label: "Amount", align: "right" },
            ]}
            rows={salesPaymentRows}
            emptyTitle="No payment breakdown"
          />
        </div>

        <ReportSection
          id="top-items"
          title="Item-wise sales"
          subtitle={periodLabel}
          filename={`item-sales-${periodDays}d.csv`}
          loading={loading}
          columns={[
            { key: "rank", label: "#", align: "right" },
            { key: "name", label: "Item" },
            { key: "quantity", label: "Qty", align: "right" },
            { key: "revenueFormatted", label: "Revenue", align: "right" },
          ]}
          rows={topItemRows}
          emptyTitle="No item sales data"
        />

        <ReportSection
          id="inventory"
          title="Inventory report"
          subtitle="Current stock snapshot"
          filename="inventory-report.csv"
          loading={loading}
          summary={
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <p>Ingredients: <strong>{inventory.length}</strong></p>
              <p>Low stock: <strong className="text-red-600">{lowStockCount}</strong></p>
              <p>Total value: <strong>{formatCurrency(inventoryValue)}</strong></p>
            </div>
          }
          columns={[
            { key: "name", label: "Ingredient" },
            { key: "category", label: "Category" },
            { key: "unit", label: "Unit" },
            { key: "available", label: "Available", align: "right" },
            { key: "reorderLevel", label: "Reorder", align: "right" },
            { key: "isLowStockLabel", label: "Low stock" },
            { key: "costFormatted", label: "Unit cost", align: "right" },
            { key: "valueFormatted", label: "Value", align: "right" },
          ]}
          rows={inventoryRows}
          emptyTitle="No inventory data"
        />

        <ReportSection
          id="wastage"
          title="Wastage report"
          subtitle={periodLabel}
          filename={`wastage-${periodDays}d.csv`}
          loading={loading}
          summary={
            <p className="text-sm">
              {wastage.length} events · Total value <strong className="text-red-600">{formatCurrency(wastageValue)}</strong>
            </p>
          }
          columns={[
            { key: "date", label: "Date" },
            { key: "ingredient", label: "Ingredient" },
            { key: "quantity", label: "Qty", align: "right" },
            { key: "unit", label: "Unit" },
            { key: "valueFormatted", label: "Value", align: "right" },
            { key: "notes", label: "Notes" },
          ]}
          rows={wastageRows}
          emptyTitle="No wastage recorded"
        />

        <Panel
          id="food-cost"
          title="Food cost analysis"
          subtitle={periodLabel}
          action={
            foodCost ? (
              <button
                type="button"
                onClick={() =>
                  downloadCsv("food-cost-summary.csv", ["Metric", "Value"], [
                    ["Revenue", foodCost.revenue],
                    ["Actual consumption", foodCost.actualConsumption],
                    ["Theoretical consumption", foodCost.theoreticalConsumption],
                    ["Variance", foodCost.variance],
                    ["Food cost %", foodCost.foodCostPct],
                    ["Theoretical food cost %", foodCost.theoreticalFoodCostPct],
                    ["Purchases", foodCost.purchases],
                  ])
                }
                className="inline-flex items-center gap-1.5 text-sm font-medium text-kaana hover:underline"
              >
                Download CSV
              </button>
            ) : undefined
          }
        >
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : !foodCost ? (
            <EmptyState title="No food cost data" />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div><p className="text-gray-500">Revenue</p><p className="font-semibold text-lg">{formatCurrency(foodCost.revenue)}</p></div>
              <div><p className="text-gray-500">Actual consumption</p><p className="font-semibold text-lg">{formatCurrency(foodCost.actualConsumption)}</p></div>
              <div><p className="text-gray-500">Theoretical consumption</p><p className="font-semibold text-lg">{formatCurrency(foodCost.theoreticalConsumption)}</p></div>
              <div><p className="text-gray-500">Variance</p><p className={`font-semibold text-lg ${foodCost.variance > 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(foodCost.variance)}</p></div>
              <div><p className="text-gray-500">Food cost %</p><p className="font-semibold text-lg">{foodCost.foodCostPct.toFixed(1)}%</p></div>
              <div><p className="text-gray-500">Purchases</p><p className="font-semibold text-lg">{formatCurrency(foodCost.purchases)}</p></div>
            </div>
          )}
        </Panel>

        <ReportSection
          id="consumption"
          title="Ingredient consumption"
          subtitle={periodLabel}
          filename={`consumption-${periodDays}d.csv`}
          loading={loading}
          columns={[
            { key: "rank", label: "#", align: "right" },
            { key: "name", label: "Ingredient" },
            { key: "quantity", label: "Qty", align: "right" },
            { key: "unit", label: "Unit" },
            { key: "valueFormatted", label: "Value", align: "right" },
          ]}
          rows={consumptionRows}
          emptyTitle="No consumption data"
        />

        <ReportSection
          id="suppliers"
          title="Supplier performance"
          filename="supplier-performance.csv"
          loading={loading}
          columns={[
            { key: "name", label: "Supplier" },
            { key: "totalPurchasesFormatted", label: "Total purchases", align: "right" },
            { key: "onTimeDeliveryPct", label: "On-time %", align: "right" },
            { key: "rejectionRate", label: "Rejection %", align: "right" },
            { key: "openPOs", label: "Open POs", align: "right" },
            { key: "outstandingFormatted", label: "Outstanding", align: "right" },
            { key: "lastPurchase", label: "Last purchase" },
          ]}
          rows={supplierRows}
          emptyTitle="No suppliers"
        />

        <ReportSection
          id="reconciliation"
          title="Payment reconciliation"
          subtitle={periodLabel}
          filename={`reconciliation-${periodDays}d.csv`}
          loading={loading}
          summary={
            reconciliation ? (
              <div className="grid sm:grid-cols-3 gap-3 text-sm mb-2">
                <p>Collected: <strong>{formatCurrency(reconciliation.totalCollected)}</strong></p>
                <p>Expected settlement: <strong>{formatCurrency(reconciliation.expectedSettlement)}</strong></p>
                <p>Variance: <strong>{formatCurrency(reconciliation.variance)}</strong></p>
              </div>
            ) : undefined
          }
          columns={[
            { key: "method", label: "Payment method" },
            { key: "amountFormatted", label: "Amount", align: "right" },
          ]}
          rows={reconciliationMethodRows}
          emptyTitle="No reconciliation data"
        />

        <ReportSection
          id="outlet-comparison"
          title="Outlet comparison"
          subtitle={periodLabel}
          filename={`outlet-comparison-${periodDays}d.csv`}
          loading={loading}
          columns={[
            { key: "outlet", label: "Outlet" },
            { key: "orders", label: "Orders", align: "right" },
            { key: "revenueFormatted", label: "Revenue", align: "right" },
            { key: "aovFormatted", label: "Avg order", align: "right" },
          ]}
          rows={comparisonRows}
          emptyTitle="No outlet comparison data"
        />

        <ReportSection
          id="gst"
          title="GST invoices"
          subtitle={periodLabel}
          filename={`gst-invoices-${periodDays}d.csv`}
          loading={loading}
          summary={
            gst ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm mb-2">
                <p>Invoices: <strong>{gst.totalInvoices ?? 0}</strong></p>
                <p>Taxable: <strong>{formatCurrency(Number(gst.totalTaxable ?? 0))}</strong></p>
                <p>CGST: <strong>{formatCurrency(Number(gst.totalCGST ?? 0))}</strong></p>
                <p>SGST: <strong>{formatCurrency(Number(gst.totalSGST ?? 0))}</strong></p>
                <p>Total: <strong>{formatCurrency(Number(gst.totalAmount ?? 0))}</strong></p>
              </div>
            ) : undefined
          }
          columns={[
            { key: "invoiceNumber", label: "Invoice #" },
            { key: "date", label: "Date" },
            { key: "gstin", label: "GSTIN" },
            { key: "taxableFormatted", label: "Taxable", align: "right" },
            { key: "cgstFormatted", label: "CGST", align: "right" },
            { key: "sgstFormatted", label: "SGST", align: "right" },
            { key: "totalFormatted", label: "Total", align: "right" },
          ]}
          rows={gstRows}
          emptyTitle="No GST invoices"
        />
      </div>
    </PageContent>
  );
}
