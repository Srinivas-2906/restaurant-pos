import { CAPTAIN_WEB_URL } from "@kaana/role-shells";
import type { OrderDto } from "@kaana/shared-types";
import { getPermissionsFromToken, getRolesFromToken, isAccessTokenExpired } from "@kaana/api-client";
import { normalizeMenuCategories, type MenuApiResponse } from "@kaana/api-client";

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

export interface MenuCategory {
  id: string;
  name: string;
  items: Array<{
    id: string;
    name: string;
    basePrice: number | string;
    isAvailable?: boolean;
    isVeg?: boolean;
  }>;
}

const TERMINAL_CREDENTIAL_KEY = "captainTerminalCredential";
const OPERATIONAL_STAFF_KEY = "operationalStaff";

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
    window.location.href = CAPTAIN_WEB_URL;
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
  localStorage.removeItem("captainOutletId");
  localStorage.removeItem("selectedOutletId");
  localStorage.removeItem(OPERATIONAL_STAFF_KEY);
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
  localStorage.setItem("captainOutletId", data.outletId);
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

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u) : null;
}

export function setSelectedOutletId(outletId: string) {
  localStorage.setItem("selectedOutletId", outletId);
  localStorage.setItem("captainOutletId", outletId);
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
    const newToken = await refreshTokenOnce();
    if (newToken) return api<T>(path, options, true);
    redirectToLogin();
    throw new Error("Session expired — please sign in again");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || "Request failed");
  }

  const text = await res.text();
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

export async function resolveOutletId(): Promise<string | null> {
  const selected = localStorage.getItem("selectedOutletId");
  if (selected) return selected;
  const cached = localStorage.getItem("captainOutletId");
  if (cached) return cached;

  const user = getUser();
  const fromRole = user?.roles?.find((r) => r.outletId)?.outletId ?? user?.roles?.[0]?.outletId ?? null;
  if (fromRole) {
    setSelectedOutletId(fromRole);
    return fromRole;
  }

  const orgs = await api<Array<{ brands?: Array<{ outlets?: Array<{ id: string }> }> }>>("/organizations");
  const outletId = orgs[0]?.brands?.[0]?.outlets?.[0]?.id ?? null;
  if (outletId) setSelectedOutletId(outletId);
  return outletId;
}

export function formatInr(amount: number | string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount));
}

export async function fetchMenu(outletId: string) {
  const raw = await api<MenuApiResponse>(`/outlets/${outletId}/menu`);
  return normalizeMenuCategories(raw);
}

export async function fetchOutletSettings(outletId: string) {
  return api<{ settings?: Record<string, unknown> }>(`/outlets/${outletId}`);
}

export async function getOpenOrderByTable(outletId: string, tableId: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_URL}/orders/open/by-table?outletId=${outletId}&tableId=${tableId}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 404) return null;
  if (res.status === 401) {
    const newToken = await refreshTokenOnce();
    if (newToken) return getOpenOrderByTable(outletId, tableId);
    redirectToLogin();
    throw new Error("Session expired — please sign in again");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || "Request failed");
  }
  return res.json() as Promise<OrderDto>;
}

export async function createTableOrder(outletId: string, tableId: string, guestCount: number) {
  return api<OrderDto>("/orders", {
    method: "POST",
    body: JSON.stringify({
      outletId,
      tableId,
      type: "dine_in",
      source: "captain",
      guestCount,
    }),
  });
}

export async function fetchOrder(orderId: string) {
  return api<OrderDto>(`/orders/${orderId}`);
}

export async function addOrderItem(orderId: string, menuItemId: string, quantity = 1) {
  await api(`/orders/${orderId}/items`, {
    method: "POST",
    body: JSON.stringify({ menuItemId, quantity }),
  });
  return fetchOrder(orderId);
}

export async function updateItemQty(orderId: string, itemId: string, quantity: number) {
  await api(`/orders/${orderId}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
  return fetchOrder(orderId);
}

export async function removeOrderItem(orderId: string, itemId: string) {
  await api(`/orders/${orderId}/items/${itemId}`, { method: "DELETE" });
  return fetchOrder(orderId);
}

export async function fireKot(orderId: string) {
  return api<Array<{ kotNumber: string }>>(`/orders/${orderId}/kot`, { method: "POST" });
}

export async function markItemServed(orderId: string, itemId: string) {
  return api<OrderDto>(`/orders/${orderId}/items/${itemId}/served`, { method: "PATCH" });
}

export async function requestBill(orderId: string) {
  return api<OrderDto>(`/orders/${orderId}/request-bill`, { method: "POST" });
}

export async function settleOrder(
  orderId: string,
  payments: Array<{ method: string; amount: number; reference?: string }>,
) {
  return api(`/orders/${orderId}/settle`, {
    method: "POST",
    body: JSON.stringify({ payments }),
  });
}

export { API_URL };
