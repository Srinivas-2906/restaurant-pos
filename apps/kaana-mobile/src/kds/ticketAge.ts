export function elapsedMinutes(iso: string, nowMs = Date.now()): number {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60_000));
}

export function formatElapsed(iso: string, nowMs = Date.now()): string {
  const mins = elapsedMinutes(iso, nowMs);
  if (mins < 1) return "<1 min";
  return `${mins} min`;
}

export function ageTone(iso: string, nowMs = Date.now()): "normal" | "warn" | "late" {
  const mins = elapsedMinutes(iso, nowMs);
  if (mins >= 15) return "late";
  if (mins >= 8) return "warn";
  return "normal";
}
