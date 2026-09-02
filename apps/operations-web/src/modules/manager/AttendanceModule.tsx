"use client";

import { useEffect, useState } from "react";
import { LogIn, UserCheck, UserX, Palmtree } from "lucide-react";
import { api, getOutletId } from "@/lib/api";
import { StaffNav } from "./StaffNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  AttendanceSourceBadge,
  ATTENDANCE_SOURCES,
  getAttendanceSource,
} from "@/lib/attendanceSource";
import { computeHoursWorked, normalizeAttendanceSnapshot, type AttendanceSnapshot } from "@/lib/attendanceSnapshot";

interface PunchRow {
  id: string;
  name: string;
  role: string | null;
  clockIn: string;
  clockOut?: string | null;
  source?: string;
  isActive?: boolean;
  hoursWorked: number;
}

interface StaffRow {
  id: string;
  employeeCode?: string;
  displayName?: string | null;
  legalName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  wageType?: string;
  user?: { firstName: string; lastName: string | null } | null;
}

interface CorrectionRow {
  id: string;
  reason: string;
  status: string;
  requestedClockIn?: string | null;
  requestedClockOut?: string | null;
  staffProfileId: string;
}

interface OvertimeRow {
  id: string;
  workDate: string;
  requestedHours: number | string;
  reason: string;
  status: string;
  staffProfileId: string;
}

type Tab = "summary" | "punch-log" | "corrections" | "overtime";

const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm";

function formatStaffName(s: StaffRow) {
  if (s.displayName?.trim()) return s.displayName.trim();
  if (s.legalName?.trim()) return s.legalName.trim();
  if (s.firstName?.trim()) return `${s.firstName} ${s.lastName ?? ""}`.trim();
  if (s.user) return `${s.user.firstName} ${s.user.lastName ?? ""}`.trim();
  return s.employeeCode ?? s.id.slice(0, 8);
}

export function AttendanceModule() {
  const [tab, setTab] = useState<Tab>("summary");
  const [summary, setSummary] = useState<AttendanceSnapshot | null>(null);
  const [punchLog, setPunchLog] = useState<PunchRow[]>([]);
  const [corrections, setCorrections] = useState<CorrectionRow[]>([]);
  const [overtime, setOvertime] = useState<OvertimeRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState("");
  const [corrForm, setCorrForm] = useState({ staffProfileId: "", reason: "", requestedClockIn: "", requestedClockOut: "" });
  const [otForm, setOtForm] = useState({ staffProfileId: "", workDate: "", requestedHours: "", reason: "" });
  const outletId = getOutletId();

  function loadSummary() {
    if (!outletId) return;
    api<AttendanceSnapshot>(`/staff/outlets/${outletId}/attendance?date=${date}`)
      .then((data) => setSummary(normalizeAttendanceSnapshot(data)))
      .catch(() => setSummary(null));
  }

  function loadPunchLog() {
    if (!outletId) return;
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    api<PunchRow[]>(
      `/staff/outlets/${outletId}/attendance/history?from=${dayStart.toISOString()}&to=${dayEnd.toISOString()}`,
    )
      .then((rows) =>
        setPunchLog(
          rows.map((p) => ({
            ...p,
            hoursWorked: computeHoursWorked(p.clockIn, p.clockOut, p.hoursWorked),
          })),
        ),
      )
      .catch(() => setPunchLog([]));
  }

  function loadCorrections() {
    if (!outletId) return;
    api<CorrectionRow[]>(`/hr/attendance-corrections?outletId=${outletId}`).then(setCorrections).catch(() => setCorrections([]));
  }

  function loadOvertime() {
    if (!outletId) return;
    api<OvertimeRow[]>(`/hr/overtime?outletId=${outletId}`).then(setOvertime).catch(() => setOvertime([]));
  }

  function loadStaff() {
    if (!outletId) return;
    api<StaffRow[]>(`/staff/outlets/${outletId}`).then(setStaff).catch(() => setStaff([]));
  }

  useEffect(loadSummary, [outletId, date]);
  useEffect(loadPunchLog, [outletId, date]);
  useEffect(() => {
    loadStaff();
    loadCorrections();
    loadOvertime();
  }, [outletId]);

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      await api("/hr/attendance-corrections", {
        method: "POST",
        body: JSON.stringify({
          ...corrForm,
          outletId,
          requestedClockIn: corrForm.requestedClockIn || undefined,
          requestedClockOut: corrForm.requestedClockOut || undefined,
        }),
      });
      setMsg("Correction submitted");
      loadCorrections();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function submitOvertime(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      await api("/hr/overtime", {
        method: "POST",
        body: JSON.stringify({
          ...otForm,
          outletId,
          requestedHours: Number(otForm.requestedHours),
        }),
      });
      setMsg("Overtime request submitted");
      loadOvertime();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function approveCorrection(id: string) {
    await api(`/hr/attendance-corrections/${id}/approve`, { method: "PATCH" });
    loadCorrections();
  }

  async function approveOvertime(id: string) {
    await api(`/hr/overtime/${id}/approve`, { method: "PATCH" });
    loadOvertime();
  }

  const staffLabel = (id: string) => {
    const s = staff.find((x) => x.id === id);
    return s ? formatStaffName(s) : id.slice(0, 8);
  };

  return (
    <PageContent>
      <PageHeader
        title="Attendance"
        description="Daily check-in summary, punch log, corrections and overtime."
        action={
          tab === "summary" || tab === "punch-log" ? (
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          ) : undefined
        }
      />
      <StaffNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <div className="flex gap-2 mb-6 flex-wrap">
        {(["summary", "punch-log", "corrections", "overtime"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize ${
              tab === t ? "bg-sidebar text-white" : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            {t === "summary" ? "Daily summary" : t === "punch-log" ? "Punch log" : t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide self-center mr-1">Punch channels</span>
        {Object.values(ATTENDANCE_SOURCES).map((meta) => {
          const Icon = meta.Icon;
          const count = summary?.sourceBreakdown?.[meta.key] ?? 0;
          return (
            <span
              key={meta.key}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${meta.badgeClass}`}
              title={meta.description}
            >
              <Icon className="w-3 h-3" />
              {meta.label}
              {count > 0 && <span className="opacity-70">({count})</span>}
            </span>
          );
        })}
      </div>

      {tab === "summary" && (
        <>
          <div className="grid md:grid-cols-5 gap-4 mb-6">
            <MetricCard label="Total staff" value={String(summary?.totals.staff ?? 0)} />
            <MetricCard label="On floor" value={String(summary?.totals.onFloor ?? 0)} icon={<LogIn className="w-5 h-5" />} />
            <MetricCard label="Checked in" value={String(summary?.totals.checkedIn ?? 0)} icon={<UserCheck className="w-5 h-5" />} />
            <MetricCard label="Not in yet" value={String(summary?.totals.notInYet ?? 0)} icon={<UserX className="w-5 h-5" />} />
            <MetricCard label="On leave" value={String(summary?.totals.onLeave ?? 0)} icon={<Palmtree className="w-5 h-5" />} />
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <Panel title="On floor now">
              {(summary?.onFloor?.length ?? 0) === 0 ? (
                <EmptyState title="No one on floor" />
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {summary?.onFloor?.map((a) => (
                    <li key={a.id} className="py-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{a.name}</p>
                        <p className="text-gray-500">{a.role ?? "—"} · {new Date(a.clockIn).toLocaleTimeString()} · {computeHoursWorked(a.clockIn, undefined, a.hoursWorked).toFixed(1)}h</p>
                      </div>
                      <AttendanceSourceBadge source={a.source} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Checked in today">
              {(summary?.checkedIn.length ?? 0) === 0 ? (
                <EmptyState title="No check-ins" />
              ) : (
                <ul className="divide-y divide-gray-100 text-sm">
                  {summary?.checkedIn.map((a) => (
                    <li key={a.id} className="py-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {a.name}
                          {a.isActive && <span className="text-[10px] font-semibold uppercase text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Active</span>}
                        </p>
                        <p className="text-gray-500">
                          {a.role ?? "—"} · In {new Date(a.clockIn).toLocaleTimeString()}
                          {a.clockOut ? ` · Out ${new Date(a.clockOut).toLocaleTimeString()}` : ""} · {computeHoursWorked(a.clockIn, a.clockOut, a.hoursWorked).toFixed(1)}h
                        </p>
                      </div>
                      <AttendanceSourceBadge source={a.source} />
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
        </>
      )}

      {tab === "punch-log" && (
        <Panel title="Punch log" subtitle={`All clock-ins for ${new Date(date).toLocaleDateString("en-IN")}`}>
          {punchLog.length === 0 ? (
            <EmptyState title="No punches recorded" description="Punches from POS, mobile, or biometric devices will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-4 font-medium">Employee</th>
                    <th className="py-2 pr-4 font-medium">Channel</th>
                    <th className="py-2 pr-4 font-medium">Clock in</th>
                    <th className="py-2 pr-4 font-medium">Clock out</th>
                    <th className="py-2 font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {punchLog.map((p) => {
                    const meta = getAttendanceSource(p.source);
                    const Icon = meta.Icon;
                    return (
                      <tr key={p.id}>
                        <td className="py-3 pr-4">
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.role ?? "—"}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium ${meta.badgeClass}`}>
                            <Icon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-700">{new Date(p.clockIn).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</td>
                        <td className="py-3 pr-4 text-gray-700">
                          {p.clockOut ? new Date(p.clockOut).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : (
                            <span className="text-green-700 font-medium">On floor</span>
                          )}
                        </td>
                        <td className="py-3 text-gray-700">{computeHoursWorked(p.clockIn, p.clockOut, p.hoursWorked).toFixed(1)}h</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === "corrections" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Panel title="Request correction">
            <form onSubmit={submitCorrection} className="space-y-3">
              <select value={corrForm.staffProfileId} onChange={(e) => setCorrForm({ ...corrForm, staffProfileId: e.target.value })} className={inputClass} required>
                <option value="">Employee...</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{formatStaffName(s)}</option>)}
              </select>
              <input type="datetime-local" value={corrForm.requestedClockIn} onChange={(e) => setCorrForm({ ...corrForm, requestedClockIn: e.target.value })} className={inputClass} />
              <input type="datetime-local" value={corrForm.requestedClockOut} onChange={(e) => setCorrForm({ ...corrForm, requestedClockOut: e.target.value })} className={inputClass} />
              <textarea value={corrForm.reason} onChange={(e) => setCorrForm({ ...corrForm, reason: e.target.value })} placeholder="Reason" rows={2} className={inputClass} required />
              <button type="submit" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Submit</button>
            </form>
          </Panel>
          <Panel title="Correction requests">
            {corrections.length === 0 ? <EmptyState title="No corrections" /> : (
              <ul className="divide-y divide-gray-100 text-sm">
                {corrections.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="flex justify-between">
                      <span className="font-medium">{staffLabel(c.staffProfileId)}</span>
                      <span className="capitalize text-gray-500">{c.status}</span>
                    </div>
                    <p className="text-gray-600 mt-1">{c.reason}</p>
                    {c.status === "pending" && (
                      <button type="button" onClick={() => approveCorrection(c.id)} className="text-green-700 text-xs font-medium mt-2">Approve</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {tab === "overtime" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Panel title="Request overtime">
            <form onSubmit={submitOvertime} className="space-y-3">
              <select value={otForm.staffProfileId} onChange={(e) => setOtForm({ ...otForm, staffProfileId: e.target.value })} className={inputClass} required>
                <option value="">Employee...</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{formatStaffName(s)}</option>)}
              </select>
              <input type="date" value={otForm.workDate} onChange={(e) => setOtForm({ ...otForm, workDate: e.target.value })} className={inputClass} required />
              <input type="number" step="0.5" value={otForm.requestedHours} onChange={(e) => setOtForm({ ...otForm, requestedHours: e.target.value })} placeholder="Hours" className={inputClass} required />
              <textarea value={otForm.reason} onChange={(e) => setOtForm({ ...otForm, reason: e.target.value })} placeholder="Reason" rows={2} className={inputClass} required />
              <button type="submit" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Submit</button>
            </form>
          </Panel>
          <Panel title="Overtime requests">
            {overtime.length === 0 ? <EmptyState title="No overtime requests" /> : (
              <ul className="divide-y divide-gray-100 text-sm">
                {overtime.map((o) => (
                  <li key={o.id} className="py-3">
                    <div className="flex justify-between">
                      <span className="font-medium">{staffLabel(o.staffProfileId)}</span>
                      <span className="capitalize text-gray-500">{o.status}</span>
                    </div>
                    <p className="text-gray-600">{new Date(o.workDate).toLocaleDateString()} · {Number(o.requestedHours)}h</p>
                    <p className="text-gray-500">{o.reason}</p>
                    {o.status === "pending" && (
                      <button type="button" onClick={() => approveOvertime(o.id)} className="text-green-700 text-xs font-medium mt-2">Approve</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </PageContent>
  );
}
