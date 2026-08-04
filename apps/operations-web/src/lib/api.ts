const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || "http://localhost:4100";

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

export function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = now.toISOString();
  return { from, to };
}

export { API_URL, HUB_URL };
