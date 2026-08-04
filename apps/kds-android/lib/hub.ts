const HUB = process.env.EXPO_PUBLIC_HUB_URL ?? "http://10.0.2.2:4100";

export async function hub<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${HUB}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) throw new Error("Hub request failed");
  return res.json();
}
