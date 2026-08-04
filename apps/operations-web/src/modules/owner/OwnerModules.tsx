"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { MarginAlertCard, formatCurrency } from "@kaana/ui";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

export function ProfitabilityModule() {
  const outletId = getOutletId();
  const [report, setReport] = useState<{ avgMargin: number; lossMakingCount: number } | null>(null);

  useEffect(() => {
    if (!outletId) return;
    api<{ avgMargin: number; lossMakingCount: number }>(`/margins/outlet/${outletId}`).then(setReport).catch(() => {});
  }, [outletId]);

  return (
    <section className="mb-8">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <MetricCard label="Avg Margin" value={report ? `${report.avgMargin.toFixed(1)}%` : "—"} />
        <MetricCard label="Loss-making Orders" value={report?.lossMakingCount ?? "—"} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MarginAlertCard title="Swiggy Combo loses money" description="Butter Chicken + Naan via aggregator" amount={-19} severity="critical" />
        <MarginAlertCard title="Paneer Tikka — healthy margin" description="Top contributor" amount={89} severity="warning" />
      </div>
    </section>
  );
}

export function RecommendationsModule() {
  const outletId = getOutletId();
  const [recs, setRecs] = useState<Array<{ id: string; title: string; prediction: string; proposedActions: string[]; status: string }>>([]);

  useEffect(() => {
    if (!outletId) return;
    api<typeof recs>(`/recommendations/pending?outletId=${outletId}`).then(setRecs).catch(() => {});
  }, [outletId]);

  async function approve(id: string) {
    await api(`/recommendations/${id}/approve`, { method: "POST" });
    setRecs((r) => r.filter((x) => x.id !== id));
  }

  return (
    <PageContent>
      <PageHeader title="Recommendations" description="AI-suggested actions pending approval." />
      <div className="space-y-4">
        {recs.length === 0 ? (
          <Panel><EmptyState title="No pending recommendations" /></Panel>
        ) : (
          recs.map((r) => (
            <Panel key={r.id}>
              <p className="font-semibold">{r.title}</p>
              <p className="text-sm text-gray-600 mt-1">{r.prediction}</p>
              <button type="button" onClick={() => approve(r.id)} className="mt-3 text-sm text-kaana font-medium hover:underline">Approve</button>
            </Panel>
          ))
        )}
      </div>
    </PageContent>
  );
}

export function AlertsModule() {
  const [unsynced, setUnsynced] = useState<Array<{ name: string; syncBacklog: number }>>([]);

  useEffect(() => {
    api<Array<{ name: string; syncBacklog: number }>>("/devices/unsynced").then(setUnsynced).catch(() => {});
  }, []);

  return (
    <PageContent>
      <PageHeader title="Alerts" description="Device sync and operational warnings." />
      <div className="space-y-4">
        {unsynced.length === 0 ? (
          <Panel><EmptyState title="No alerts" description="All devices are synced." /></Panel>
        ) : (
          unsynced.map((d, i) => (
            <MarginAlertCard key={i} title={`Sync backlog: ${d.name}`} description={`${d.syncBacklog} events pending`} amount={d.syncBacklog} severity="warning" />
          ))
        )}
      </div>
    </PageContent>
  );
}

export function OutletsModule() {
  const [outlets, setOutlets] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") ?? "{}");
    const brandId = user?.organization?.brands?.[0]?.id;
    if (brandId) api<Array<Record<string, unknown>>>(`/outlets?brandId=${brandId}`).then(setOutlets).catch(() => {});
  }, []);

  return (
    <PageContent>
      <PageHeader title="Outlets" description="Manage restaurant locations." />
      <div className="space-y-4">
        {outlets.length === 0 ? (
          <Panel><EmptyState title="No outlets" /></Panel>
        ) : (
          outlets.map((o) => (
            <Panel key={o.id as string}>
              <h3 className="font-semibold text-lg">{o.name as string}</h3>
              <p className="text-gray-500 text-sm mt-1">{o.code as string} · {String(o.type).replace("_", " ")}</p>
              <p className="text-sm text-gray-400 mt-1">{o.address as string}, {o.city as string}</p>
            </Panel>
          ))
        )}
      </div>
    </PageContent>
  );
}

export function DevicesModule() {
  const [health, setHealth] = useState<{ devices: Array<{ name: string; deviceType: string; status: string; syncBacklog: number; lastSeenAt?: string }> } | null>(null);

  useEffect(() => {
    api<typeof health>("/devices/health").then(setHealth).catch(() => {});
  }, []);

  return (
    <PageContent>
      <PageHeader title="Devices" description="POS terminals, KDS screens, and sync status." />
      <Panel title="Registered devices">
        {!health?.devices?.length ? (
          <EmptyState title="No devices registered" />
        ) : (
          <ul className="divide-y divide-gray-100 -mx-1">
            {health.devices.map((d, i) => (
              <li key={i} className="py-3 text-sm flex justify-between items-center">
                <span>{d.name} <span className="text-gray-400">({d.deviceType})</span></span>
                <span className={d.status === "online" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{d.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}

export function ReportsModule() {
  const outletId = getOutletId();
  const [comparison, setComparison] = useState<Array<{ outletName?: string; revenue?: number; orders?: number }>>([]);

  useEffect(() => {
    const { from, to } = { from: new Date(Date.now() - 30 * 86400000).toISOString(), to: new Date().toISOString() };
    api<Array<{ outletName?: string; revenue?: number; orders?: number }>>(`/reports/outlets/comparison?from=${from}&to=${to}`).then(setComparison).catch(() => {});
  }, [outletId]);

  return (
    <PageContent>
      <PageHeader title="Reports" description="Cross-outlet performance comparison." />
      <Panel title="Outlet comparison (30 days)">
        {comparison.length === 0 ? (
          <EmptyState title="No comparison data" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {comparison.map((r, i) => (
              <li key={i} className="py-3 text-sm flex justify-between">
                <span className="font-medium">{r.outletName ?? `Outlet ${i + 1}`}</span>
                <span className="text-gray-600">{formatCurrency(Number(r.revenue ?? 0))} · {r.orders ?? 0} orders</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}
