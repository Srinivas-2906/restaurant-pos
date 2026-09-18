export function formatInr(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN").format(n);
}

export function startOfDayIso(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function endOfDayIso(date = new Date()): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function periodPresets() {
  const now = new Date();
  const todayStart = startOfDayIso(now);
  const todayEnd = endOfDayIso(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = daysAgoIso(6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return {
    today: { from: todayStart, to: todayEnd, label: "Today" },
    yesterday: { from: startOfDayIso(yesterday), to: endOfDayIso(yesterday), label: "Yesterday" },
    week: { from: weekStart, to: todayEnd, label: "This week" },
    month: { from: monthStart, to: todayEnd, label: "This month" },
  };
}

export function formatOrderStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}
