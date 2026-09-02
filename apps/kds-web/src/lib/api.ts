import { KDS_WEB_URL } from "@kaana/role-shells";

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
export const WS_URL = resolveWsUrl();

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  roles?: Array<{ role: string; outletId?: string | null }>;
}

function redirectToLogin() {
  logout();
  if (typeof window !== "undefined") {
    window.location.href = KDS_WEB_URL;
  }
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.message || err.error || "Login failed");
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string; user: AuthUser };
  localStorage.setItem("token", data.accessToken);
  localStorage.setItem("refreshToken", data.refreshToken);
  localStorage.setItem("user", JSON.stringify(data.user));
  if (data.user.id) localStorage.setItem("userId", data.user.id);
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("userId");
  localStorage.removeItem("kdsOutletId");
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u) : null;
}

export function setSelectedOutletId(outletId: string) {
  localStorage.setItem("selectedOutletId", outletId);
}

export async function api<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
    redirectToLogin();
    throw new Error("Session expired — please sign in again");
  }

  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export async function resolveDefaultOutletId(): Promise<string | null> {
  const cached = localStorage.getItem("kdsOutletId") ?? localStorage.getItem("selectedOutletId");
  if (cached) return cached;

  const user = getUser();
  const fromRole = user?.roles?.find((r) => r.outletId)?.outletId ?? user?.roles?.[0]?.outletId ?? null;
  if (fromRole) {
    localStorage.setItem("kdsOutletId", fromRole);
    return fromRole;
  }

  const orgs = await api<Array<{ brands?: Array<{ outlets?: Array<{ id: string }> }> }>>("/organizations");
  const outletId = orgs[0]?.brands?.[0]?.outlets?.[0]?.id ?? null;
  if (outletId) localStorage.setItem("kdsOutletId", outletId);
  return outletId;
}

export async function loadOutletName(outletId: string): Promise<string> {
  const outlet = await api<{ name: string }>(`/outlets/${outletId}`);
  return outlet.name;
}
