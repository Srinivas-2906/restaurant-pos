"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { StaffNav } from "./StaffNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

interface LeaveRow {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  staff: { user: { firstName: string; lastName: string | null } };
}

interface StaffRow {
  userId: string;
  user: { firstName: string; lastName: string | null };
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

export function LeavesModule() {
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [userId, setUserId] = useState("");
  const [type, setType] = useState("casual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<LeaveRow[]>(`/staff/outlets/${outletId}/leaves`).then(setLeaves).catch(() => setLeaves([]));
    api<Holiday[]>(`/staff/outlets/${outletId}/holidays`).then(setHolidays).catch(() => setHolidays([]));
    api<StaffRow[]>(`/staff/outlets/${outletId}`).then(setStaff).catch(() => setStaff([]));
  }

  useEffect(load, [outletId]);

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      await api(`/staff/outlets/${outletId}/leaves`, {
        method: "POST",
        body: JSON.stringify({ userId, type, startDate, endDate, reason }),
      });
      setMsg("Leave request created");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function updateStatus(id: string, status: "approved" | "rejected") {
    await api(`/staff/leaves/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  }

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    await api(`/staff/outlets/${outletId}/holidays`, {
      method: "POST",
      body: JSON.stringify({ date: holidayDate, name: holidayName }),
    });
    setMsg("Holiday added");
    load();
  }

  return (
    <PageContent>
      <PageHeader title="Leaves & holidays" description="Track time off and public holidays." />
      <StaffNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Request leave">
          <form onSubmit={submitLeave} className="space-y-3">
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required>
              <option value="">Employee...</option>
              {staff.map((s) => <option key={s.userId} value={s.userId}>{s.user.firstName} {s.user.lastName}</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5">
              {["casual", "sick", "earned", "unpaid", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2.5" required />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2.5" required />
            </div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
            <button type="submit" className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">Submit</button>
          </form>
        </Panel>
        <Panel title="Add holiday">
          <form onSubmit={addHoliday} className="space-y-3">
            <input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required />
            <input value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="Holiday name" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required />
            <button type="submit" className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">Add holiday</button>
          </form>
          <ul className="mt-4 divide-y divide-gray-100 text-sm">
            {holidays.map((h) => (
              <li key={h.id} className="py-2 flex justify-between">
                <span>{h.name}</span>
                <span className="text-gray-500">{new Date(h.date).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Leave requests">
        {leaves.length === 0 ? (
          <EmptyState title="No leave requests" />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Employee</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Dates</th>
                  <th className="text-left p-3">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100">
                    <td className="p-3">{l.staff.user.firstName} {l.staff.user.lastName}</td>
                    <td className="p-3 capitalize">{l.type}</td>
                    <td className="p-3">{new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}</td>
                    <td className="p-3 capitalize">{l.status}</td>
                    <td className="p-3">
                      {l.status === "pending" && (
                        <span className="flex gap-2">
                          <button type="button" onClick={() => updateStatus(l.id, "approved")} className="text-green-700 text-xs font-medium">Approve</button>
                          <button type="button" onClick={() => updateStatus(l.id, "rejected")} className="text-red-600 text-xs font-medium">Reject</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageContent>
  );
}
