const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:4000/api").replace(/\/+$/, "");

let token = "";
let refreshToken = "";

export async function login(email?: string, password?: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email ?? "captain@kaanafoods.in",
      password: password ?? "password123",
    }),
  });
  if (!res.ok) throw new Error("Login failed");
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  token = data.accessToken;
  refreshToken = data.refreshToken;
  return data;
}

async function refreshAccessToken() {
  if (!refreshToken) return false;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { accessToken: string };
  token = data.accessToken;
  return true;
}

export async function api<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401 && !retried) {
    const ok = await refreshAccessToken();
    if (ok) return api<T>(path, options, true);
    await login();
    return api<T>(path, options, true);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.message || err.error || "Request failed");
  }
  return res.json();
}

export async function resolveOutletId(): Promise<string> {
  if (!token) await login();
  const orgs = await api<Array<{ brands?: Array<{ outlets?: Array<{ id: string }> }> }>>("/organizations");
  return orgs[0]?.brands?.[0]?.outlets?.[0]?.id ?? "";
}

export async function fetchMenu(outletId: string) {
  return api<Array<{ id: string; name: string; items: Array<{ id: string; name: string; basePrice: number; isAvailable?: boolean }> }>>(
    `/outlets/${outletId}/menu`,
  );
}

export async function getOpenOrderByTable(outletId: string, tableId: string) {
  return api<Record<string, unknown> | null>(`/orders/open/by-table?outletId=${outletId}&tableId=${tableId}`);
}

export async function createTableOrder(outletId: string, tableId: string, guestCount: number) {
  return api<Record<string, unknown>>("/orders", {
    method: "POST",
    body: JSON.stringify({ outletId, tableId, type: "dine_in", source: "captain", guestCount }),
  });
}

export async function addOrderItem(orderId: string, menuItemId: string) {
  await api(`/orders/${orderId}/items`, {
    method: "POST",
    body: JSON.stringify({ menuItemId, quantity: 1 }),
  });
  return api<Record<string, unknown>>(`/orders/${orderId}`);
}

export async function fireKot(orderId: string) {
  return api(`/orders/${orderId}/kot`, { method: "POST" });
}

export async function requestBill(orderId: string) {
  return api(`/orders/${orderId}/request-bill`, { method: "POST" });
}

export async function markItemServed(orderId: string, itemId: string) {
  return api(`/orders/${orderId}/items/${itemId}/served`, { method: "PATCH" });
}

export async function registerDevice(deviceId: string) {
  try {
    const HUB = process.env.EXPO_PUBLIC_HUB_URL ?? "http://10.0.2.2:4100";
    await fetch(`${HUB}/hub/devices/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, outletId: "local-outlet", role: "captain", deviceType: "captain", name: "Captain Tablet" }),
    });
  } catch {
    // hub optional
  }
}
