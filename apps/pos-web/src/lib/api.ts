const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

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
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed");
  return res.json();
}

export async function login(email: string, password: string) {
  const data = await api<{ accessToken: string; user?: unknown }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem("token", data.accessToken);
  return data;
}

export const TABLE_COLORS: Record<string, string> = {
  free: "bg-green-600 hover:bg-green-500",
  seated: "bg-orange-600 hover:bg-orange-500",
  billed: "bg-blue-600 hover:bg-blue-500",
  blocked: "bg-gray-600",
  reserved: "bg-purple-600",
};
