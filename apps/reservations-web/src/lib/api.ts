import { getLoginPortalUrl } from "@kaana/role-shells";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000/events";

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { accessToken: string };
  localStorage.setItem("token", data.accessToken);
  return data.accessToken;
}

function refreshTokenOnce(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function redirectToLogin() {
  logout();
  if (typeof window !== "undefined") {
    window.location.href = getLoginPortalUrl(window.location.origin);
  }
}

function isAccessTokenExpired(token: string, skewSeconds = 60): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() >= (payload.exp - skewSeconds) * 1000;
  } catch {
    return true;
  }
}

async function getValidAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  const refreshToken = localStorage.getItem("refreshToken");
  if (token && !isAccessTokenExpired(token)) return token;
  if (!refreshToken) return token;
  return refreshTokenOnce();
}

export async function api<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = typeof window !== "undefined" ? await getValidAccessToken() : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
    const newToken = await refreshTokenOnce();
    if (newToken) return api<T>(path, options, true);
    redirectToLogin();
    throw new Error("Session expired — please sign in again");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.message || err.error || "Request failed");
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
  if (typeof window === "undefined") return null;
  const selected = localStorage.getItem("selectedOutletId");
  if (selected) return selected;
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
}

export async function loadOrganizationOutlets(): Promise<OutletSummary[]> {
  const orgs = await api<
    Array<{ brands?: Array<{ outlets?: OutletSummary[] }> }>
  >("/organizations");

  const outlets: OutletSummary[] = [];
  for (const org of orgs) {
    for (const brand of org.brands ?? []) {
      for (const outlet of brand.outlets ?? []) {
        outlets.push(outlet);
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

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("selectedOutletId");
}

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

export { API_URL };
