function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveApiUrl() {
  const raw = trimSlash(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

function resolveWsUrl() {
  if (process.env.NEXT_PUBLIC_WS_URL) return trimSlash(process.env.NEXT_PUBLIC_WS_URL);
  return `${resolveApiUrl().replace(/\/api$/, "")}/events`;
}

const API_URL = resolveApiUrl();
export const HUB_URL = trimSlash(process.env.NEXT_PUBLIC_HUB_URL || "http://localhost:4100");
export const WS_URL = resolveWsUrl();

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

export async function hub<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${HUB_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) throw new Error("Hub request failed");
  return res.json();
}

export async function login(email: string, password: string) {
  const data = await api<{ accessToken: string; refreshToken: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("token", data.accessToken);
  localStorage.setItem("refreshToken", data.refreshToken);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("selectedOutletId");
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  organization?: { brands?: Array<{ id: string }> };
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

export function setSelectedOutletId(outletId: string) {
  localStorage.setItem("selectedOutletId", outletId);
}

export interface OutletSummary {
  id: string;
  name: string;
  code: string;
  type: string;
  address?: string | null;
  city?: string | null;
  isActive?: boolean;
  brandId?: string;
}

export async function loadOrganizationOutlets(): Promise<OutletSummary[]> {
  const orgs = await api<
    Array<{
      brands?: Array<{
        id: string;
        outlets?: OutletSummary[];
      }>;
    }>
  >("/organizations");

  const outlets: OutletSummary[] = [];
  for (const org of orgs) {
    for (const brand of org.brands ?? []) {
      for (const outlet of brand.outlets ?? []) {
        if (outlet.isActive !== false) {
          outlets.push({ ...outlet, brandId: brand.id });
        }
      }
    }
  }
  return outlets;
}

export async function ensureOutletSelected(): Promise<string | null> {
  const current = getOutletId();
  const outlets = await loadOrganizationOutlets();
  if (current && outlets.some((o) => o.id === current)) {
    return current;
  }
  const preferred = outlets.find((o) => o.type === "dine_in") ?? outlets[0];
  if (preferred) {
    setSelectedOutletId(preferred.id);
    return preferred.id;
  }
  return null;
}

export function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = now.toISOString();
  return { from, to };
}

export function daysAgoRange(days: number) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function formatCountDelta(current: number, previous: number) {
  const diff = current - previous;
  if (diff === 0) return { text: "Same as yesterday", positive: undefined as boolean | undefined };
  const sign = diff > 0 ? "+" : "";
  return { text: `${sign}${diff} vs yesterday`, positive: diff > 0 };
}

export function formatRevenueDelta(current: number, previous: number) {
  const diff = current - previous;
  if (diff === 0) return { text: "Same as yesterday", positive: undefined as boolean | undefined };
  const sign = diff > 0 ? "+" : "-";
  return {
    text: `${sign}₹${Math.abs(diff).toLocaleString("en-IN")} vs yesterday`,
    positive: diff > 0,
  };
}

export { API_URL };

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-violet-100 text-violet-800",
  arrived: "bg-sky-100 text-sky-800",
  seated: "bg-emerald-100 text-emerald-800",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-800",
  pending: "bg-amber-100 text-amber-800",
};

export const TABLE_PHASE_STYLES: Record<string, { card: string; dot: string }> = {
  free: { card: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  reserved: { card: "bg-violet-50 border-violet-300", dot: "bg-violet-500" },
  ordering: { card: "bg-orange-50 border-orange-300", dot: "bg-orange-500" },
  kitchen: { card: "bg-amber-50 border-amber-300", dot: "bg-amber-500" },
  bill_printed: { card: "bg-slate-100 border-slate-300", dot: "bg-slate-500" },
  blocked: { card: "bg-red-50 border-red-200", dot: "bg-red-400" },
  cleaning: { card: "bg-blue-50 border-blue-200", dot: "bg-blue-400" },
};
