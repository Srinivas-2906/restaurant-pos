export type MoneyPeriodPreset = "today" | "yesterday" | "week" | "month" | "custom";

/** Offset in ms between UTC and the given IANA timezone at `date`. */
export function timezoneOffsetMs(timeZone: string, date: Date): number {
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const zoned = new Date(date.toLocaleString("en-US", { timeZone }));
  return zoned.getTime() - utc.getTime();
}

/** YYYY-MM-DD calendar date in the given timezone. */
export function calendarDateInTimezone(timeZone: string, date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** UTC instants for local midnight..end-of-day in `timeZone` on `calendarDay` (YYYY-MM-DD). */
export function dayBoundsUtc(timeZone: string, calendarDay: string): { from: Date; to: Date } {
  const startLocal = new Date(`${calendarDay}T00:00:00.000Z`);
  const endLocal = new Date(`${calendarDay}T23:59:59.999Z`);
  const offset = timezoneOffsetMs(timeZone, startLocal);
  return {
    from: new Date(startLocal.getTime() - offset),
    to: new Date(endLocal.getTime() - offset),
  };
}

export function resolveMoneyPeriod(
  timeZone: string,
  preset: MoneyPeriodPreset,
  customFrom?: string,
  customTo?: string,
  anchor = new Date(),
): { from: Date; to: Date; label: string } {
  const today = calendarDateInTimezone(timeZone, anchor);

  if (preset === "today") {
    const b = dayBoundsUtc(timeZone, today);
    return { ...b, label: "Today" };
  }

  if (preset === "yesterday") {
    const y = new Date(anchor);
    y.setDate(y.getDate() - 1);
    const day = calendarDateInTimezone(timeZone, y);
    const b = dayBoundsUtc(timeZone, day);
    return { ...b, label: "Yesterday" };
  }

  if (preset === "week") {
    const end = dayBoundsUtc(timeZone, today).to;
    const weekStart = new Date(anchor);
    weekStart.setDate(weekStart.getDate() - 6);
    const startDay = calendarDateInTimezone(timeZone, weekStart);
    const from = dayBoundsUtc(timeZone, startDay).from;
    return { from, to: end, label: "This week" };
  }

  if (preset === "month") {
    const parts = today.split("-");
    const monthStart = `${parts[0]}-${parts[1]}-01`;
    const from = dayBoundsUtc(timeZone, monthStart).from;
    const to = dayBoundsUtc(timeZone, today).to;
    return { from, to, label: "This month" };
  }

  const fromDay = customFrom ?? today;
  const toDay = customTo ?? today;
  return {
    from: dayBoundsUtc(timeZone, fromDay).from,
    to: dayBoundsUtc(timeZone, toDay).to,
    label: "Custom",
  };
}
