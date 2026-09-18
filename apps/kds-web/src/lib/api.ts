import { KDS_WEB_URL } from "@kaana/role-shells";
import { getPermissionsFromToken, getRolesFromToken, isAccessTokenExpired } from "@kaana/api-client";

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

const TERMINAL_CREDENTIAL_KEY = "kdsTerminalCredential";
const OPERATIONAL_STAFF_KEY = "operationalStaff";

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
  localStorage.removeItem(OPERATIONAL_STAFF_KEY);
  if (data.user.id) localStorage.setItem("userId", data.user.id);
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  localStorage.removeItem("userId");
  localStorage.removeItem("kdsOutletId");
  localStorage.removeItem("selectedOutletId");
  localStorage.removeItem(OPERATIONAL_STAFF_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u) : null;
}

export function setSelectedOutletId(outletId: string) {
  localStorage.setItem("selectedOutletId", outletId);
  localStorage.setItem("kdsOutletId", outletId);
}

export function getPermissionsFromSession(): string[] {
  if (typeof window === "undefined") return [];
  return getPermissionsFromToken(localStorage.getItem("token"));
}

export function getRolesFromSession(): string[] {
  if (typeof window === "undefined") return [];
  return getRolesFromToken(localStorage.getItem("token"));
}

export function hasValidSession(): boolean {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("token");
  if (!token) return false;
  return !isAccessTokenExpired(token);
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
  localStorage.setItem(TERMINAL_CREDENTIAL_KEY, JSON.stringify({ terminalId, deviceSecret }));
}

export function clearTerminalCredential() {
  localStorage.removeItem(TERMINAL_CREDENTIAL_KEY);
}

async function terminalApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const credential = getTerminalCredential();
  if (!credential) throw new Error("Terminal not registered on this device");

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
  return terminalApi<{ id: string; name: string; code: string; deviceType: string }>(
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
  localStorage.setItem("kdsOutletId", data.outletId);
  localStorage.removeItem("user");
  localStorage.removeItem("userId");
  return data;
}

export async function registerTerminal(terminalId: string) {
  return api<{
    terminal: { id: string; name: string; code: string };
    deviceSecret: string;
  }>(`/terminals/${terminalId}/register`, { method: "POST" });
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

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const payload = token ? JSON.parse(atob(token.split(".")[1] ?? "")) as { outletId?: string } : null;
  if (payload?.outletId) {
    localStorage.setItem("kdsOutletId", payload.outletId);
    return payload.outletId;
  }

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
