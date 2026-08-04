"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

interface StaffRow {
  id: string;
  employeeCode: string;
  user: { firstName: string; lastName: string; email: string };
}

interface OnFloorRow {
  id?: string;
  user?: { firstName?: string; lastName?: string };
  role?: string;
}

interface ShiftRow {
  id?: string;
  startTime?: string;
  endTime?: string;
  staffProfile?: { user?: { firstName?: string; lastName?: string } };
}

export function StaffModule() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [onFloor, setOnFloor] = useState<OnFloorRow[]>([]);
  const outletId = getOutletId();

  useEffect(() => {
    if (!outletId) return;
    api<StaffRow[]>(`/staff/outlets/${outletId}`).then(setStaff).catch(() => setStaff([]));
    api<ShiftRow[]>(`/staff/outlets/${outletId}/shifts`).then(setShifts).catch(() => setShifts([]));
    api<OnFloorRow[]>(`/staff/outlets/${outletId}/on-floor`).then(setOnFloor).catch(() => setOnFloor([]));
  }, [outletId]);

  return (
    <PageContent className="space-y-6">
      <PageHeader title="Staff & Shifts" description="Team roster, floor presence, and scheduled shifts." />

      <Panel title={`On floor now (${onFloor.length})`}>
        {onFloor.length === 0 ? (
          <EmptyState title="No one clocked in" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {onFloor.map((a, i) => (
              <li key={a.id ?? i} className="py-2 text-sm flex justify-between">
                <span>{a.user?.firstName} {a.user?.lastName}</span>
                <span className="text-gray-500 capitalize">{a.role?.replace(/_/g, " ") ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Scheduled shifts">
        {shifts.length === 0 ? (
          <EmptyState title="No shifts scheduled" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {shifts.map((s, i) => (
              <li key={s.id ?? i} className="py-2 text-sm">
                <span className="font-medium">{s.staffProfile?.user?.firstName} {s.staffProfile?.user?.lastName}</span>
                <span className="text-gray-500 ml-2">{s.startTime} – {s.endTime}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Team (${staff.length})`}>
        {staff.length === 0 ? (
          <EmptyState title="No staff" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {staff.map((s) => (
              <li key={s.id} className="py-2 text-sm flex justify-between">
                <span>{s.user.firstName} {s.user.lastName}</span>
                <span className="text-gray-500">{s.employeeCode}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}
