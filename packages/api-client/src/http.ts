import { resolveApiUrl } from "./config";
import { isAccessTokenExpired } from "./session";

export type ApiClientOptions = {
  apiUrl?: string;
  getToken: () => string | null;
  getRefreshToken: () => string | null;
  setToken: (token: string) => void;
  onUnauthorized?: () => void;
};

export function createApiClient(options: ApiClientOptions) {
  const apiUrl = resolveApiUrl(options.apiUrl);
  let refreshInFlight: Promise<string | null> | null = null;

  async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = options.getRefreshToken();
    if (!refreshToken) return null;

    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { accessToken: string };
    options.setToken(data.accessToken);
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

  async function getValidAccessToken(): Promise<string | null> {
    const token = options.getToken();
    const refreshToken = options.getRefreshToken();
    if (token && !isAccessTokenExpired(token)) return token;
    if (!refreshToken) return token;
    return refreshTokenOnce();
  }

  async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
    const token = await getValidAccessToken();
    const res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });

    if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
      const newToken = await refreshTokenOnce();
      if (newToken) return api<T>(path, init, true);
      options.onUnauthorized?.();
      throw new Error("Session expired — please sign in again");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.message || err.error || "Request failed");
    }

    return res.json() as Promise<T>;
  }

  return { api, apiUrl, getValidAccessToken };
}

export type ApiClient = ReturnType<typeof createApiClient>;
