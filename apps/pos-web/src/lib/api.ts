import { POS_WEB_URL } from "@kaana/role-shells";

const TERMINAL_CREDENTIAL_KEY = "posTerminalCredential";
const OPERATIONAL_STAFF_KEY = "operationalStaff";

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
    window.location.href = POS_WEB_URL;
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

export function logout() {
  logoutSession();
}

export function logoutSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("userId");
  localStorage.removeItem("selectedOutletId");
  localStorage.removeItem(OPERATIONAL_STAFF_KEY);
}

export function getTerminalCredential(): { terminalId: string; deviceSecret: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(TERMINAL_CREDENTIAL_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { terminalId: string; deviceSecret: string };
    if (parsed.terminalId && parsed.deviceSecret) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function setTerminalCredential(terminalId: string, deviceSecret: string) {
  localStorage.setItem(
    TERMINAL_CREDENTIAL_KEY,
    JSON.stringify({ terminalId, deviceSecret }),
  );
}

export function clearTerminalCredential() {
  localStorage.removeItem(TERMINAL_CREDENTIAL_KEY);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split(".")[1] ?? "")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getAuthMode(): "email" | "operational" | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const mode = payload?.authMode;
  return mode === "operational" ? "operational" : mode === "email" ? "email" : "email";
}

export function isEmailSession(): boolean {
  return getAuthMode() !== "operational";
}

export function getOperationalStaff(): {
  id: string;
  displayName: string;
  employeeCode: string;
  role: string;
} | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(OPERATIONAL_STAFF_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function hasValidSession(): boolean {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("token");
  if (!token) return false;
  return !isAccessTokenExpired(token);
}

async function terminalApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const credential = getTerminalCredential();
  if (!credential) {
    throw new Error("Terminal not registered on this device");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Terminal ${credential.terminalId}:${credential.deviceSecret}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.message || err.error || "Request failed");
  }
  return res.json();
}

export async function fetchTerminalMe() {
  return terminalApi<{ id: string; name: string; code: string; outlet: { id: string; name: string } }>(
    "/operational/terminals/me",
  );
}

export async function fetchEligibleStaff() {
  return terminalApi<
    Array<{ id: string; displayName: string; employeeCode: string; profilePhotoUrl: string | null }>
  >("/operational/terminals/me/eligible-staff");
}

export async function operationalPinLogin(staffProfileId: string, pin: string) {
  const data = await terminalApi<{
    accessToken: string;
    refreshToken?: string;
    staff: { id: string; displayName: string; employeeCode: string; role: string };
    outletId: string;
    terminalId: string;
  }>("/operational/pin-login", {
    method: "POST",
    body: JSON.stringify({ staffProfileId, pin }),
  });

  localStorage.setItem("token", data.accessToken);
  if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);
  localStorage.setItem(OPERATIONAL_STAFF_KEY, JSON.stringify(data.staff));
  localStorage.setItem("selectedOutletId", data.outletId);
  localStorage.setItem("terminalId", data.terminalId);
  localStorage.removeItem("user");
  localStorage.removeItem("userId");
  return data;
}

export async function registerTerminal(terminalId: string) {
  return api<{
    terminal: { id: string; name: string; code: string; outlet: { id: string; name: string } };
    deviceSecret: string;
  }>(`/terminals/${terminalId}/register`, { method: "POST" });
}

export async function login(email: string, password: string) {
  const data = await api<{ accessToken: string; refreshToken: string; user: AuthUser }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    false,
  );
  localStorage.setItem("token", data.accessToken);
  localStorage.setItem("refreshToken", data.refreshToken);
  localStorage.setItem("user", JSON.stringify(data.user));
  localStorage.removeItem(OPERATIONAL_STAFF_KEY);
  if (data.user.id) localStorage.setItem("userId", data.user.id);
  return data;
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
  ready_to_serve: {
    card: "bg-emerald-50 border-emerald-300",
    dot: "bg-emerald-500",
    label: "text-emerald-800",
    ring: "ring-emerald-200",
  },
  serving: {
    card: "bg-teal-50 border-teal-300",
    dot: "bg-teal-500",
    label: "text-teal-800",
    ring: "ring-teal-200",
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
  cleaning: {
    card: "bg-sky-50 border-sky-200",
    dot: "bg-sky-400",
    label: "text-sky-700",
    ring: "ring-sky-200",
  },
};

/** @deprecated use TABLE_PHASE_STYLES */
export const TABLE_STYLES: Record<string, { card: string; dot: string; label: string }> = Object.fromEntries(
  Object.entries(TABLE_PHASE_STYLES).map(([k, v]) => [k, { card: v.card, dot: v.dot, label: v.label }]),
);

export { API_URL };

export async function fetchOrderInbox(outletId: string) {
  return api<import("@/components/pos/floor/types").Order[]>(`/orders/inbox?outletId=${outletId}`);
}

export async function simulatePartnerOrder(outletId: string, source: "swiggy" | "zomato") {
  return api<import("@/components/pos/floor/types").Order>(`/v1/simulate/${outletId}/${source}`, {
    method: "POST",
  });
}

export async function cancelOrder(orderId: string, reason?: string) {
  return api(`/orders/${orderId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
