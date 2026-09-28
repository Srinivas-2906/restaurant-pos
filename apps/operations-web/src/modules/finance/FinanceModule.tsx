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
import { formatCurrency, DisabledFeatureRoute } from "@kaana/ui";
import { useCapabilities } from "@/contexts/CapabilitiesContext";
export { PayrollModule } from "./PayrollModules";

export function FinanceReportsModule() {
  const { capabilities, ready } = useCapabilities();
  if (ready && capabilities?.modules.finance === false) {
    return <DisabledFeatureRoute featureLabel="Finance" reason="Finance is not enabled for your restaurant." />;
  }
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

type AccountRow = { id: string; code: string; name: string; type: string; isActive: boolean };

export function ChartOfAccountsModule() {
  const { capabilities, ready } = useCapabilities();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  if (ready && capabilities?.modules.finance === false) {
    return <DisabledFeatureRoute featureLabel="Finance" reason="Finance is not enabled for your restaurant." />;
  }

  useEffect(() => {
    setLoading(true);
    api<AccountRow[]>("/accounting/accounts")
      .then(setAccounts)
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  const rows = accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    status: a.isActive ? "Active" : "Inactive",
  }));

  return (
    <PageContent>
      <PageHeader title="Chart of Accounts" description="Organization-level GL accounts (journal-derived reporting)." />
      <FinanceNav />
      <ReportSection
        title="Accounts"
        filename="chart-of-accounts.csv"
        loading={loading}
        columns={[
          { key: "code", label: "Code" },
          { key: "name", label: "Name" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
        ]}
        rows={rows}
        emptyTitle="No accounts"
        emptyDescription="Run accounting bootstrap or seed to create default accounts."
      />
    </PageContent>
  );
}

export function JournalModule() {
  const { capabilities, ready } = useCapabilities();
  const [entries, setEntries] = useState<Array<{
    id: string;
    postingDate: string;
    reference: string;
    description: string;
    sourceEvent: string;
    lines?: Array<{ glAccount?: { code: string; name: string }; debit: number; credit: number }>;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const outletId = getOutletId();

  if (ready && capabilities?.modules.finance === false) {
    return <DisabledFeatureRoute featureLabel="Finance" reason="Finance is not enabled for your restaurant." />;
  }

  useEffect(() => {
    setLoading(true);
    const q = outletId ? `?outletId=${outletId}&limit=100` : "?limit=100";
    api<typeof entries>(`/accounting/entries${q}`)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [outletId]);

  const rows = entries.flatMap((e) =>
    (e.lines ?? []).map((l, i) => ({
      id: `${e.id}-${i}`,
      date: formatReportDate(e.postingDate),
      reference: e.reference,
      source: e.sourceEvent,
      account: l.glAccount ? `${l.glAccount.code} ${l.glAccount.name}` : "",
      debit: Number(l.debit) > 0 ? formatCurrency(Number(l.debit)) : "",
      credit: Number(l.credit) > 0 ? formatCurrency(Number(l.credit)) : "",
      description: e.description,
    })),
  );

  return (
    <PageContent>
      <PageHeader title="Journal Entries" description="Posted double-entry journals from business events." />
      <FinanceNav />
      <ReportSection
        title="Journal lines"
        filename="journal-entries.csv"
        loading={loading}
        columns={[
          { key: "date", label: "Date" },
          { key: "reference", label: "Ref" },
          { key: "source", label: "Source" },
          { key: "account", label: "Account" },
          { key: "debit", label: "Debit", align: "right" },
          { key: "credit", label: "Credit", align: "right" },
          { key: "description", label: "Description" },
        ]}
        rows={rows}
        emptyTitle="No journal entries"
      />
    </PageContent>
  );
}

export function TrialBalanceModule() {
  const { capabilities, ready } = useCapabilities();
  const [data, setData] = useState<{
    ok?: boolean;
    totalDebits?: number;
    totalCredits?: number;
    rows?: Array<{ accountCode: string; accountName: string; closingDebit: number; closingCredit: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const outletId = getOutletId();

  if (ready && capabilities?.modules.finance === false) {
    return <DisabledFeatureRoute featureLabel="Finance" reason="Finance is not enabled for your restaurant." />;
  }

  useEffect(() => {
    setLoading(true);
    const q = outletId ? `?outletId=${outletId}` : "";
    api<typeof data>(`/accounting/reports/trial-balance${q}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [outletId]);

  const rows = (data?.rows ?? []).map((r) => ({
    id: r.accountCode,
    code: r.accountCode,
    name: r.accountName,
    debit: r.closingDebit > 0 ? formatCurrency(r.closingDebit) : "",
    credit: r.closingCredit > 0 ? formatCurrency(r.closingCredit) : "",
  }));

  return (
    <PageContent>
      <PageHeader title="Trial Balance" description="Journal-derived account balances. Debits must equal credits." />
      <FinanceNav />
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Total debits" value={formatCurrency(Number(data?.totalDebits ?? 0))} loading={loading} />
        <MetricCard label="Total credits" value={formatCurrency(Number(data?.totalCredits ?? 0))} loading={loading} />
        <MetricCard label="Balanced" value={data?.ok ? "Yes" : "No"} loading={loading} />
      </div>
      <ReportSection
        title="Trial balance"
        filename="trial-balance.csv"
        loading={loading}
        columns={[
          { key: "code", label: "Code" },
          { key: "name", label: "Account" },
          { key: "debit", label: "Debit", align: "right" },
          { key: "credit", label: "Credit", align: "right" },
        ]}
        rows={rows}
        emptyTitle="No posted activity"
      />
    </PageContent>
  );
}

export function ProfitLossModule() {
  const { capabilities, ready } = useCapabilities();
  const { from, to } = useMemo(() => monthRange(), []);
  const [data, setData] = useState<{
    netRevenue?: number;
    cogs?: number;
    grossProfit?: number;
    netProfit?: number;
    revenue?: Array<{ name: string; amount: number }>;
    expenses?: Array<{ name: string; amount: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const outletId = getOutletId();

  if (ready && capabilities?.modules.finance === false) {
    return <DisabledFeatureRoute featureLabel="Finance" reason="Finance is not enabled for your restaurant." />;
  }

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ from, to });
    if (outletId) q.set("outletId", outletId);
    api<typeof data>(`/accounting/reports/profit-and-loss?${q}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [outletId, from, to]);

  const revenueRows = (data?.revenue ?? []).map((r) => ({
    id: r.name,
    name: r.name,
    amount: formatCurrency(r.amount),
  }));
  const expenseRows = (data?.expenses ?? []).map((r) => ({
    id: r.name,
    name: r.name,
    amount: formatCurrency(r.amount),
  }));

  return (
    <PageContent>
      <PageHeader title="Profit & Loss" description="Revenue and expense accounts from posted journals (current month)." />
      <FinanceNav />
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Net revenue" value={formatCurrency(Number(data?.netRevenue ?? 0))} loading={loading} />
        <MetricCard label="COGS" value={formatCurrency(Number(data?.cogs ?? 0))} loading={loading} />
        <MetricCard label="Gross profit" value={formatCurrency(Number(data?.grossProfit ?? 0))} loading={loading} />
        <MetricCard label="Net profit" value={formatCurrency(Number(data?.netProfit ?? 0))} loading={loading} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <ReportSection title="Revenue" filename="pl-revenue.csv" loading={loading} columns={[{ key: "name", label: "Account" }, { key: "amount", label: "Amount", align: "right" }]} rows={revenueRows} emptyTitle="No revenue" />
        <ReportSection title="Expenses" filename="pl-expenses.csv" loading={loading} columns={[{ key: "name", label: "Account" }, { key: "amount", label: "Amount", align: "right" }]} rows={expenseRows} emptyTitle="No expenses" />
      </div>
    </PageContent>
  );
}

export function BalanceSheetModule() {
  const { capabilities, ready } = useCapabilities();
  const [data, setData] = useState<{
    ok?: boolean;
    totalAssets?: number;
    totalLiabilities?: number;
    totalEquity?: number;
    retainedEarnings?: number;
    equation?: { assets: number; liabilitiesPlusEquity: number };
    assets?: Array<{ accountName: string; closingDebit: number; closingCredit: number }>;
    liabilities?: Array<{ accountName: string; closingDebit: number; closingCredit: number }>;
    equity?: Array<{ accountName: string; closingDebit: number; closingCredit: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const outletId = getOutletId();

  if (ready && capabilities?.modules.finance === false) {
    return <DisabledFeatureRoute featureLabel="Finance" reason="Finance is not enabled for your restaurant." />;
  }

  useEffect(() => {
    setLoading(true);
    const q = outletId ? `?outletId=${outletId}` : "";
    api<typeof data>(`/accounting/reports/balance-sheet${q}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [outletId]);

  type BsRow = { accountName: string; closingDebit: number; closingCredit: number };
  const mapBs = (items?: BsRow[]) =>
    (items ?? []).map((r) => ({
      id: r.accountName,
      name: r.accountName,
      amount: formatCurrency(r.closingDebit - r.closingCredit),
    }));

  return (
    <PageContent>
      <PageHeader title="Balance Sheet" description="Assets = Liabilities + Equity (journal-derived, as of today)." />
      <FinanceNav />
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total assets" value={formatCurrency(Number(data?.totalAssets ?? 0))} loading={loading} />
        <MetricCard label="Total liabilities" value={formatCurrency(Number(data?.totalLiabilities ?? 0))} loading={loading} />
        <MetricCard label="Total equity" value={formatCurrency(Number(data?.totalEquity ?? 0))} loading={loading} />
        <MetricCard label="Equation OK" value={data?.ok ? "Yes" : "No"} loading={loading} />
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <ReportSection title="Assets" filename="balance-sheet-assets.csv" loading={loading} columns={[{ key: "name", label: "Account" }, { key: "amount", label: "Balance", align: "right" }]} rows={mapBs(data?.assets)} emptyTitle="No assets" />
        <ReportSection title="Liabilities" filename="balance-sheet-liabilities.csv" loading={loading} columns={[{ key: "name", label: "Account" }, { key: "amount", label: "Balance", align: "right" }]} rows={mapBs(data?.liabilities)} emptyTitle="No liabilities" />
        <ReportSection title="Equity" filename="balance-sheet-equity.csv" loading={loading} columns={[{ key: "name", label: "Account" }, { key: "amount", label: "Balance", align: "right" }]} rows={mapBs(data?.equity)} emptyTitle="No equity accounts" />
      </div>
      {data?.retainedEarnings != null && (
        <Panel className="mt-4 p-4 text-sm">
          Retained earnings (cumulative P&L through as-of date): <strong>{formatCurrency(data.retainedEarnings)}</strong>
        </Panel>
      )}
    </PageContent>
  );
}
