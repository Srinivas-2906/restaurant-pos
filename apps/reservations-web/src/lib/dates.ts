/** Local calendar date as YYYY-MM-DD (not UTC). */
export function localDateIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True when an ISO datetime falls on the given local calendar day (YYYY-MM-DD). */
export function isOnLocalDay(iso: string, day: string): boolean {
  const d = new Date(iso);
  return localDateIso(d) === day;
}
