"use client";

import { useEffect, useState } from "react";
import { api, getOutletId, monthRange } from "@/lib/api";
import { FinanceNav } from "./FinanceNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@kaana/ui";

export function FinanceReportsModule() {
  const [sales, setSales] = useState<Record<string, unknown> | null>(null);
  const [items, setItems] = useState<Array<{ name: string; quantity: number; revenue: number }>>([]);
  const outletId = getOutletId();
  const { from, to } = monthRange();

  useEffect(() => {
    if (!outletId) return;
    api<Record<string, unknown>>(`/reports/sales?outletId=${outletId}&from=${from}&to=${to}`).then(setSales).catch(() => {});
    api<Array<{ name: string; quantity: number; revenue: number }>>(`/reports/items?outletId=${outletId}&from=${from}&to=${to}`).then(setItems).catch(() => setItems([]));
  }, [outletId, from, to]);

  return (
    <PageContent>
      <PageHeader title="Finance" description="Sales reports and revenue analytics." />
      <FinanceNav />
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Revenue" value={formatCurrency(Number(sales?.totalRevenue ?? 0))} />
        <MetricCard label="Orders" value={String(sales?.totalOrders ?? 0)} />
        <MetricCard label="Avg order" value={formatCurrency(Number(sales?.avgOrderValue ?? 0))} />
      </div>
      <Panel title="Top items">
        {items.length === 0 ? (
          <EmptyState title="No item data" description="Sales data will appear once orders are recorded." />
        ) : (
          items.slice(0, 10).map((i) => (
            <div key={i.name} className="flex justify-between border-t border-gray-100 first:border-0 py-3 text-sm">
              <span className="font-medium">{i.name}</span>
              <span className="text-gray-600">{formatCurrency(i.revenue)} ({i.quantity})</span>
            </div>
          ))
        )}
      </Panel>
    </PageContent>
  );
}

export function GstModule() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const outletId = getOutletId();
  const { from, to } = monthRange();

  useEffect(() => {
    if (!outletId) return;
    api<Record<string, unknown>>(`/reports/gst/export?outletId=${outletId}&from=${from}&to=${to}`).then(setData).catch(() => {});
  }, [outletId, from, to]);

  function downloadCsv() {
    if (!data?.invoices) return;
    const rows = (data.invoices as Array<Record<string, unknown>>).map((inv) =>
      [inv.invoiceNumber, inv.date, inv.taxableAmount, inv.cgst, inv.sgst, inv.total].join(","),
    );
    const csv = ["Invoice,Date,Taxable,CGST,SGST,Total", ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "gst-export.csv";
    a.click();
  }

  return (
    <PageContent>
      <PageHeader title="GST Export" description="Download invoice data for tax filing." />
      <FinanceNav />
      <Panel title="Export">
        <p className="text-gray-600 mb-4">Invoices this period: <strong>{String(data?.totalInvoices ?? 0)}</strong></p>
        <button type="button" onClick={downloadCsv} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
          Download CSV
        </button>
      </Panel>
    </PageContent>
  );
}

export function ReconciliationModule() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const outletId = getOutletId();
  const { from, to } = monthRange();

  useEffect(() => {
    if (!outletId) return;
    api<Record<string, unknown>>(`/reports/reconciliation?outletId=${outletId}&from=${from}&to=${to}`).then(setData).catch(() => {});
  }, [outletId, from, to]);

  return (
    <PageContent>
      <PageHeader title="Reconciliation" description="Compare collected vs expected settlement." />
      <FinanceNav />
      <div className="grid md:grid-cols-2 gap-4">
        <MetricCard label="Total collected" value={formatCurrency(Number(data?.totalCollected ?? 0))} />
        <MetricCard label="Expected settlement" value={formatCurrency(Number(data?.expectedSettlement ?? 0))} />
      </div>
    </PageContent>
  );
}

export function PayrollModule() {
  const [runs, setRuns] = useState<Array<{ id: string; status: string; periodStart: string; periodEnd: string; totalGross: number | string; totalNet: number | string }>>([]);
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();
  const { from, to } = monthRange();

  function load() {
    api<typeof runs>("/payroll/runs").then(setRuns).catch(() => setRuns([]));
  }

  useEffect(load, []);

  async function createRun() {
    try {
      await api("/payroll/runs", { method: "POST", body: JSON.stringify({ outletId, periodStart: from, periodEnd: to }) });
      setMsg("Payroll run created");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader
        title="Payroll"
        description="Create and review payroll runs."
        action={
          <button type="button" onClick={createRun} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
            Run payroll (this month)
          </button>
        }
      />
      <FinanceNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}
      <div className="space-y-3">
        {runs.length === 0 ? (
          <Panel><EmptyState title="No payroll runs" description="Create a payroll run for the current month." /></Panel>
        ) : (
          runs.map((run) => (
            <Panel key={run.id}>
              <p className="font-semibold capitalize">{run.status}</p>
              <p className="text-sm text-gray-600 mt-1">
                Gross {formatCurrency(Number(run.totalGross))} · Net {formatCurrency(Number(run.totalNet))}
              </p>
            </Panel>
          ))
        )}
      </div>
    </PageContent>
  );
}
