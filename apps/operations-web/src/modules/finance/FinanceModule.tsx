"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getOutletId, monthRange } from "@/lib/api";
import { downloadCsv, formatReportDate } from "@/lib/reportExport";
import { ReportDownloadButton, ReportSection } from "@/components/reports/ReportSection";
import { FinanceNav } from "./FinanceNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@kaana/ui";
export { PayrollModule } from "./PayrollModules";

export function FinanceReportsModule() {
  const [sales, setSales] = useState<{
    totalRevenue?: number;
    totalOrders?: number;
    avgOrderValue?: number;
    bySource?: Record<string, number>;
    byPayment?: Record<string, number>;
  } | null>(null);
  const [items, setItems] = useState<Array<{ name: string; quantity: number; revenue: number }>>([]);
  const [loading, setLoading] = useState(true);
  const outletId = getOutletId();
  const { from, to } = useMemo(() => monthRange(), []);

  useEffect(() => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api<typeof sales>(`/reports/sales?outletId=${outletId}&from=${from}&to=${to}`),
      api<typeof items>(`/reports/items?outletId=${outletId}&from=${from}&to=${to}`),
    ])
      .then(([salesData, itemsData]) => {
        setSales(salesData);
        setItems(itemsData);
      })
      .catch(() => {
        setSales(null);
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [outletId, from, to]);

  const itemRows = items.map((item, i) => ({
    id: item.name,
    rank: i + 1,
    name: item.name,
    quantity: item.quantity,
    revenue: item.revenue,
    revenueFormatted: formatCurrency(item.revenue),
  }));

  const sourceRows = Object.entries(sales?.bySource ?? {}).map(([source, amount]) => ({
    id: source,
    source: source.replace(/_/g, " "),
    amountFormatted: formatCurrency(Number(amount)),
    amount: Number(amount),
  }));

  const paymentRows = Object.entries(sales?.byPayment ?? {}).map(([method, amount]) => ({
    id: method,
    method,
    amountFormatted: formatCurrency(Number(amount)),
    amount: Number(amount),
  }));

  function exportFinancePack() {
    downloadCsv("finance-item-sales.csv", ["Rank", "Item", "Quantity", "Revenue"], itemRows.map((r) => [r.rank, r.name, r.quantity, r.revenue]));
    downloadCsv("finance-sales-by-source.csv", ["Source", "Revenue"], sourceRows.map((r) => [r.source, r.amount]));
    downloadCsv("finance-sales-by-payment.csv", ["Method", "Amount"], paymentRows.map((r) => [r.method, r.amount]));
  }

  return (
    <PageContent>
      <PageHeader
        title="Finance"
        description="Sales reports and revenue analytics for the current month."
        action={<ReportDownloadButton label="Download finance CSVs" onClick={exportFinancePack} disabled={loading || !outletId} />}
      />
      <FinanceNav />
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Revenue" value={formatCurrency(Number(sales?.totalRevenue ?? 0))} loading={loading} />
        <MetricCard label="Orders" value={String(sales?.totalOrders ?? 0)} loading={loading} />
        <MetricCard label="Avg order" value={formatCurrency(Number(sales?.avgOrderValue ?? 0))} loading={loading} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <ReportSection
          title="Sales by source"
          subtitle="This month"
          filename="finance-sales-by-source.csv"
          loading={loading}
          columns={[
            { key: "source", label: "Source" },
            { key: "amountFormatted", label: "Revenue", align: "right" },
          ]}
          rows={sourceRows}
          emptyTitle="No source data"
        />
        <ReportSection
          title="Sales by payment method"
          subtitle="This month"
          filename="finance-sales-by-payment.csv"
          loading={loading}
          columns={[
            { key: "method", label: "Method" },
            { key: "amountFormatted", label: "Amount", align: "right" },
          ]}
          rows={paymentRows}
          emptyTitle="No payment data"
        />
      </div>
      <ReportSection
        title="Item-wise sales"
        subtitle="This month"
        filename="finance-item-sales.csv"
        loading={loading}
        columns={[
          { key: "rank", label: "#", align: "right" },
          { key: "name", label: "Item" },
          { key: "quantity", label: "Qty", align: "right" },
          { key: "revenueFormatted", label: "Revenue", align: "right" },
        ]}
        rows={itemRows}
        emptyTitle="No item data"
        emptyDescription="Sales data will appear once orders are recorded."
      />
    </PageContent>
  );
}

export function GstModule() {
  const [data, setData] = useState<{
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
  const [loading, setLoading] = useState(true);
  const outletId = getOutletId();
  const { from, to } = useMemo(() => monthRange(), []);

  useEffect(() => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<typeof data>(`/reports/gst/export?outletId=${outletId}&from=${from}&to=${to}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [outletId, from, to]);

  const invoiceRows = (data?.invoices ?? []).map((inv) => ({
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

  return (
    <PageContent>
      <PageHeader title="GST Export" description="View and download invoice data for tax filing." />
      <FinanceNav />
      <ReportSection
        title="GST invoices"
        subtitle="This month"
        filename="gst-export.csv"
        loading={loading}
        summary={
          data ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
              <p>Invoices: <strong>{data.totalInvoices ?? 0}</strong></p>
              <p>Taxable: <strong>{formatCurrency(Number(data.totalTaxable ?? 0))}</strong></p>
              <p>CGST: <strong>{formatCurrency(Number(data.totalCGST ?? 0))}</strong></p>
              <p>SGST: <strong>{formatCurrency(Number(data.totalSGST ?? 0))}</strong></p>
              <p>Total: <strong>{formatCurrency(Number(data.totalAmount ?? 0))}</strong></p>
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
        rows={invoiceRows}
        emptyTitle="No invoices this month"
      />
    </PageContent>
  );
}

export function ReconciliationModule() {
  const [data, setData] = useState<{
    totalCollected?: number;
    expectedSettlement?: number;
    variance?: number;
    orderCount?: number;
    byMethod?: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const outletId = getOutletId();
  const { from, to } = useMemo(() => monthRange(), []);

  useEffect(() => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<typeof data>(`/reports/reconciliation?outletId=${outletId}&from=${from}&to=${to}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [outletId, from, to]);

  const methodRows = Object.entries(data?.byMethod ?? {}).map(([method, amount]) => ({
    id: method,
    method,
    amount: Number(amount),
    amountFormatted: formatCurrency(Number(amount)),
  }));

  return (
    <PageContent>
      <PageHeader title="Reconciliation" description="Compare collected vs expected settlement." />
      <FinanceNav />
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Total collected" value={formatCurrency(Number(data?.totalCollected ?? 0))} loading={loading} />
        <MetricCard label="Expected settlement" value={formatCurrency(Number(data?.expectedSettlement ?? 0))} loading={loading} />
        <MetricCard label="Variance" value={formatCurrency(Number(data?.variance ?? 0))} loading={loading} />
      </div>
      {!loading && !data && (
        <Panel className="mb-6"><EmptyState title="No reconciliation data" /></Panel>
      )}
      <ReportSection
        title="Collections by payment method"
        subtitle="This month"
        filename="reconciliation-by-method.csv"
        loading={loading}
        columns={[
          { key: "method", label: "Payment method" },
          { key: "amountFormatted", label: "Amount", align: "right" },
        ]}
        rows={methodRows}
        emptyTitle="No payment method breakdown"
      />
    </PageContent>
  );
}
