/** Local calendar date as YYYY-MM-DD (not UTC). */
export function localDateIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isOnLocalDay(iso: string, day: string): boolean {
  return localDateIso(new Date(iso)) === day;
}
