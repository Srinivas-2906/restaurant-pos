const HUB = process.env.EXPO_PUBLIC_HUB_URL ?? "http://10.0.2.2:4100";

export async function hub<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${HUB}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) throw new Error("Hub request failed");
  return res.json();
}

const API_URL = "http://10.0.2.2:4000/api";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

let token = "";

export async function login() {
  const data = await api<{ accessToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "captain@kaanafoods.in", password: "password123" }),
  });
  token = data.accessToken;
  return data;
}

export function authFetch(path: string, options: RequestInit = {}) {
  return api(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
}

export async function registerDevice(deviceId: string) {
  return hub("/hub/devices/register", {
    method: "POST",
    body: JSON.stringify({ deviceId, outletId: "local-outlet", role: "captain", deviceType: "captain", name: "Captain Tablet" }),
  });
}
