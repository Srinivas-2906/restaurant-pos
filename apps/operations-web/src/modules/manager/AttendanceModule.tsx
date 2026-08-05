"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { StaffNav } from "./StaffNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";

interface AttendanceSummary {
  totals: { staff: number; checkedIn: number; notInYet: number; onLeave: number };
  checkedIn: Array<{ id: string; name: string; role: string | null; clockIn: string; hoursWorked: number }>;
  notInYet: Array<{ name: string; role: string | null }>;
  onLeave: Array<{ name: string }>;
}

export function AttendanceModule() {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const outletId = getOutletId();

  useEffect(() => {
    if (!outletId) return;
    api<AttendanceSummary>(`/staff/outlets/${outletId}/attendance?date=${date}`)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [outletId, date]);

  return (
    <PageContent>
      <PageHeader
        title="Attendance"
        description="Daily check-in summary and floor presence."
        action={
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        }
      />
      <StaffNav />

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total staff" value={String(summary?.totals.staff ?? 0)} />
        <MetricCard label="Checked in" value={String(summary?.totals.checkedIn ?? 0)} />
        <MetricCard label="Not in yet" value={String(summary?.totals.notInYet ?? 0)} />
        <MetricCard label="On leave" value={String(summary?.totals.onLeave ?? 0)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Panel title="Checked in">
          {(summary?.checkedIn.length ?? 0) === 0 ? (
            <EmptyState title="No check-ins" />
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {summary?.checkedIn.map((a) => (
                <li key={a.id} className="py-2">
                  <p className="font-medium">{a.name}</p>
                  <p className="text-gray-500">{a.role ?? "—"} · {new Date(a.clockIn).toLocaleTimeString()} · {a.hoursWorked.toFixed(1)}h</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Not in yet">
          {(summary?.notInYet.length ?? 0) === 0 ? (
            <EmptyState title="Everyone present or on leave" />
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {summary?.notInYet.map((a, i) => (
                <li key={i} className="py-2 flex justify-between">
                  <span>{a.name}</span>
                  <span className="text-gray-500">{a.role ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="On leave">
          {(summary?.onLeave.length ?? 0) === 0 ? (
            <EmptyState title="No leave today" />
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {summary?.onLeave.map((a, i) => (
                <li key={i} className="py-2">{a.name}</li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageContent>
  );
}
