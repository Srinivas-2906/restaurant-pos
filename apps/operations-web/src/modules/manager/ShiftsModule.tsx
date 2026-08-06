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
  staff: { user: { firstName: string; lastName: string | null }; userId?: string };
}

interface StaffRow {
  id: string;
  userId: string;
  user: { firstName: string; lastName: string | null };
}

export function ShiftsModule() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [userId, setUserId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [station, setStation] = useState("");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<ShiftRow[]>(`/staff/outlets/${outletId}/shifts`).then(setShifts).catch(() => setShifts([]));
    api<StaffRow[]>(`/staff/outlets/${outletId}`).then(setStaff).catch(() => setStaff([]));
  }

  useEffect(load, [outletId]);

  async function createShift(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      await api("/staff/shifts", {
        method: "POST",
        body: JSON.stringify({ outletId, userId, startAt, endAt, station: station || undefined }),
      });
      setMsg("Shift scheduled");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Shifts" description="Schedule staff shifts by station." />
      <StaffNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title="Schedule shift" className="mb-6 max-w-lg">
        <form onSubmit={createShift} className="space-y-4">
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required>
            <option value="">Employee...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.userId}>{s.user.firstName} {s.user.lastName}</option>
            ))}
          </select>
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required />
          <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required />
          <input value={station} onChange={(e) => setStation(e.target.value)} placeholder="Station (optional)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
          <button type="submit" className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">Add shift</button>
        </form>
      </Panel>

      <Panel title="Scheduled shifts">
        {shifts.length === 0 ? (
          <EmptyState title="No shifts scheduled" />
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {shifts.map((s) => (
              <li key={s.id} className="py-3 flex justify-between">
                <div>
                  <p className="font-medium">{s.staff.user.firstName} {s.staff.user.lastName}</p>
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
