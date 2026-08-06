const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || "Request failed");
  }
  return res.json();
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  roles?: Array<{ role: string; outletId?: string | null }>;
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u) : null;
}

export function getOutletId(): string | null {
  if (typeof window !== "undefined") {
    const selected = localStorage.getItem("selectedOutletId");
    if (selected) return selected;
  }
  const user = getUser();
  return user?.roles?.find((r) => r.outletId)?.outletId ?? user?.roles?.[0]?.outletId ?? null;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("userId");
  localStorage.removeItem("selectedOutletId");
}

export const TABLE_PHASE_STYLES: Record<string, { card: string; dot: string; label: string; ring: string }> = {
  free: {
    card: "bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
    label: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  ordering: {
    card: "bg-orange-50 border-orange-300",
    dot: "bg-orange-500",
    label: "text-orange-700",
    ring: "ring-orange-200",
  },
  kitchen: {
    card: "bg-amber-50 border-amber-300",
    dot: "bg-amber-500",
    label: "text-amber-800",
    ring: "ring-amber-200",
  },
  bill_printed: {
    card: "bg-blue-50 border-blue-400",
    dot: "bg-blue-600",
    label: "text-blue-800",
    ring: "ring-blue-200",
  },
  blocked: {
    card: "bg-slate-100 border-slate-200",
    dot: "bg-slate-400",
    label: "text-slate-500",
    ring: "ring-slate-200",
  },
  reserved: {
    card: "bg-violet-50 border-violet-300",
    dot: "bg-violet-500",
    label: "text-violet-700",
    ring: "ring-violet-200",
  },
};

/** @deprecated use TABLE_PHASE_STYLES */
export const TABLE_STYLES: Record<string, { card: string; dot: string; label: string }> = Object.fromEntries(
  Object.entries(TABLE_PHASE_STYLES).map(([k, v]) => [k, { card: v.card, dot: v.dot, label: v.label }]),
);

export { API_URL };
