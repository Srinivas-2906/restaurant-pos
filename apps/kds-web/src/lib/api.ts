const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export async function login() {
  const data = await api<{ accessToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "biller@kaanafoods.in", password: "password123" }),
  });
  localStorage.setItem("token", data.accessToken);
}
