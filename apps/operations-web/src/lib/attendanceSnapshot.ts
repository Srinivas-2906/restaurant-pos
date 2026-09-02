export interface AttendancePerson {
  id: string;
  name: string;
  role: string | null;
  clockIn: string;
  clockOut?: string | null;
  source?: string;
  isActive?: boolean;
  hoursWorked: number;
}

export interface AttendanceSnapshot {
  totals: { staff: number; checkedIn: number; onFloor: number; notInYet: number; onLeave: number };
  sourceBreakdown: Record<string, number>;
  onFloor: AttendancePerson[];
  checkedIn: AttendancePerson[];
  notInYet: Array<{ name: string; role: string | null }>;
  onLeave: Array<{ name: string }>;
}

export function computeHoursWorked(
  clockIn: string,
  clockOut?: string | null,
  hoursWorked?: number | null,
): number {
  if (hoursWorked != null && Number.isFinite(Number(hoursWorked))) return Number(hoursWorked);
  const start = new Date(clockIn).getTime();
  if (!Number.isFinite(start)) return 0;
  const end = clockOut ? new Date(clockOut).getTime() : Date.now();
  return Math.max(0, (end - start) / 3_600_000);
}

/** Normalize API responses — supports older payloads missing onFloor / sourceBreakdown. */
export function normalizeAttendanceSnapshot(raw: Partial<AttendanceSnapshot>): AttendanceSnapshot {
  const checkedIn = (raw.checkedIn ?? []).map((p) => ({
    ...p,
    hoursWorked: computeHoursWorked(p.clockIn, p.clockOut, p.hoursWorked),
  }));
  const onFloor = (raw.onFloor ?? checkedIn.filter((p) => p.isActive ?? !p.clockOut)).map((p) => ({
    ...p,
    hoursWorked: computeHoursWorked(p.clockIn, p.clockOut, p.hoursWorked),
  }));
  const sourceBreakdown =
    raw.sourceBreakdown ??
    checkedIn.reduce<Record<string, number>>((acc, p) => {
      const key = (p.source ?? "manual").toLowerCase();
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

  const totals = raw.totals ?? {
    staff: 0,
    checkedIn: checkedIn.length,
    onFloor: onFloor.length,
    notInYet: 0,
    onLeave: 0,
  };

  return {
    totals: {
      ...totals,
      onFloor: totals.onFloor ?? onFloor.length,
      checkedIn: totals.checkedIn ?? checkedIn.length,
      notInYet: totals.notInYet ?? raw.notInYet?.length ?? 0,
      onLeave: totals.onLeave ?? raw.onLeave?.length ?? 0,
      staff: totals.staff ?? 0,
    },
    sourceBreakdown,
    onFloor,
    checkedIn,
    notInYet: raw.notInYet ?? [],
    onLeave: raw.onLeave ?? [],
  };
}
