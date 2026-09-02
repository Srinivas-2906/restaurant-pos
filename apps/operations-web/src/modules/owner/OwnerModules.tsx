"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, getOutletId, setSelectedOutletId, loadOrganizationOutlets, type OutletSummary } from "@/lib/api";
import { MarginAlertCard } from "@kaana/ui";
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
  const [outlets, setOutlets] = useState<OutletSummary[]>([]);
  const [brandId, setBrandId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "dine_in",
    address: "",
    city: "",
  });

  async function refresh() {
    setLoading(true);
    try {
      const list = await loadOrganizationOutlets();
      setOutlets(list);
      if (list[0]?.brandId) setBrandId(list[0].brandId);
      setSelectedId(getOutletId());
    } catch {
      setOutlets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!brandId) {
      setError("No brand found for this organization.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api("/outlets", {
        method: "POST",
        body: JSON.stringify({ ...form, brandId }),
      });
      setShowForm(false);
      setForm({ name: "", code: "", type: "dine_in", address: "", city: "" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create outlet");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(id: string, name: string) {
    if (id === selectedId) {
      alert("Switch to another outlet before deactivating this one.");
      return;
    }
    if (!confirm(`Deactivate "${name}"? This outlet will be hidden from lists.`)) return;
    try {
      await api(`/outlets/${id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to deactivate outlet");
    }
  }

  function handleUseOutlet(id: string) {
    setSelectedOutletId(id);
    setSelectedId(id);
  }

  return (
    <PageContent>
      <PageHeader
        title="Outlets"
        description="Manage restaurant locations."
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            Add outlet
          </button>
        }
      />

      {showForm && (
        <Panel className="mb-6">
          <h3 className="font-semibold text-lg mb-4">New outlet</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                placeholder="Kaana Test Outlet"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                placeholder="BLR-TEST"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                <option value="dine_in">Dine in</option>
                <option value="cloud_kitchen">Cloud kitchen</option>
                <option value="central_kitchen">Central kitchen</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                placeholder="Bangalore"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                placeholder="Street address"
              />
            </div>
            {error && <p className="md:col-span-2 text-red-600 text-sm">{error}</p>}
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-kaana text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create outlet"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm border border-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}

      <div className="space-y-4">
        {loading ? (
          <Panel><p className="text-gray-500 text-sm">Loading outlets…</p></Panel>
        ) : outlets.length === 0 ? (
          <Panel><EmptyState title="No outlets" description="Add your first outlet to get started." /></Panel>
        ) : (
          outlets.map((o) => (
            <Panel key={o.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{o.name}</h3>
                    {selectedId === o.id && (
                      <span className="text-xs bg-kaana/10 text-kaana px-2 py-0.5 rounded-full font-medium">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm mt-1">
                    {o.code} · {o.type.replace("_", " ")}
                  </p>
                  {(o.address || o.city) && (
                    <p className="text-sm text-gray-400 mt-1">
                      {[o.address, o.city].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedId !== o.id && (
                    <button
                      type="button"
                      onClick={() => handleUseOutlet(o.id)}
                      className="text-sm text-kaana font-medium hover:underline px-3 py-1.5"
                    >
                      Use this outlet
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeactivate(o.id, o.name)}
                    disabled={selectedId === o.id}
                    className="text-sm text-red-600 font-medium hover:underline px-3 py-1.5 disabled:opacity-40 disabled:no-underline"
                  >
                    Deactivate
                  </button>
                </div>
              </div>
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

export { ReportsModule } from "@/modules/reports/ReportsModule";
