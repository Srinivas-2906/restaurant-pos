"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { StaffNav } from "./StaffNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

interface ShiftRow {
  id: string;
  startAt: string;
  endAt: string;
  station?: string | null;
  staff: {
    displayName?: string | null;
    legalName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    user: { firstName: string; lastName: string | null };
    userId?: string;
  };
}

interface StaffRow {
  id: string;
  userId?: string | null;
  displayName?: string | null;
  legalName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  user?: { firstName: string; lastName: string | null } | null;
}

interface ShiftTemplate {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  isActive: boolean;
}

export function ShiftsModule() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffProfileId, setStaffProfileId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [station, setStation] = useState("");
  const [templateForm, setTemplateForm] = useState({ name: "", code: "", startTime: "09:00", endTime: "17:00", breakMinutes: "30" });
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<ShiftRow[]>(`/staff/outlets/${outletId}/shifts`).then(setShifts).catch(() => setShifts([]));
    api<StaffRow[]>(`/staff/outlets/${outletId}`).then(setStaff).catch(() => setStaff([]));
    api<ShiftTemplate[]>(`/hr/shift-templates?outletId=${outletId}`).then(setTemplates).catch(() => setTemplates([]));
  }

  useEffect(load, [outletId]);

  async function createShift(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      await api("/staff/shifts", {
        method: "POST",
        body: JSON.stringify({ outletId, staffProfileId, startAt, endAt, station: station || undefined }),
      });
      setMsg("Shift scheduled");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      await api("/hr/shift-templates", {
        method: "POST",
        body: JSON.stringify({
          outletId,
          name: templateForm.name,
          code: templateForm.code,
          startTime: templateForm.startTime,
          endTime: templateForm.endTime,
          breakMinutes: Number(templateForm.breakMinutes),
        }),
      });
      setMsg("Shift template created");
      setTemplateForm({ name: "", code: "", startTime: "09:00", endTime: "17:00", breakMinutes: "30" });
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Roster & Shifts" description="Shift templates, roster and staffing coverage." />
      <StaffNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Shift templates">
          <form onSubmit={createTemplate} className="space-y-3 mb-4">
            <input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="Template name" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" required />
            <input value={templateForm.code} onChange={(e) => setTemplateForm({ ...templateForm, code: e.target.value })} placeholder="Code" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" required />
            <div className="grid grid-cols-2 gap-2">
              <input type="time" value={templateForm.startTime} onChange={(e) => setTemplateForm({ ...templateForm, startTime: e.target.value })} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm" required />
              <input type="time" value={templateForm.endTime} onChange={(e) => setTemplateForm({ ...templateForm, endTime: e.target.value })} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm" required />
            </div>
            <input type="number" value={templateForm.breakMinutes} onChange={(e) => setTemplateForm({ ...templateForm, breakMinutes: e.target.value })} placeholder="Break (mins)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
            <button type="submit" className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">Add template</button>
          </form>
          {templates.length === 0 ? (
            <EmptyState title="No templates" />
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {templates.map((t) => (
                <li key={t.id} className="py-2 flex justify-between">
                  <span>{t.name} <span className="text-gray-400">({t.code})</span></span>
                  <span className="text-gray-500">{t.startTime} – {t.endTime}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

      <Panel title="Schedule shift" className="max-w-lg lg:max-w-none">
        <form onSubmit={createShift} className="space-y-4">
          <select value={staffProfileId} onChange={(e) => setStaffProfileId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required>
            <option value="">Employee...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName || s.legalName || `${s.firstName ?? s.user?.firstName ?? ""} ${s.lastName ?? s.user?.lastName ?? ""}`.trim()}
              </option>
            ))}
          </select>
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required />
          <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required />
          <input value={station} onChange={(e) => setStation(e.target.value)} placeholder="Station (optional)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
          <button type="submit" className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">Add shift</button>
        </form>
      </Panel>
      </div>

      <Panel title="Scheduled shifts">
        {shifts.length === 0 ? (
          <EmptyState title="No shifts scheduled" />
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {shifts.map((s) => (
              <li key={s.id} className="py-3 flex justify-between">
                <div>
                  <p className="font-medium">
                    {s.staff.displayName || s.staff.legalName || `${s.staff.user?.firstName ?? ""} ${s.staff.user?.lastName ?? ""}`.trim()}
                  </p>
                  <p className="text-gray-500">{s.station ?? "General"}</p>
                </div>
                <span className="text-gray-600">
                  {new Date(s.startAt).toLocaleString()} – {new Date(s.endAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}
