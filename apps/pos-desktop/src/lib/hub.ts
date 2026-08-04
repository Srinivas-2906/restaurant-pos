const HUB = (window as unknown as { kaana?: { hubUrl: string; terminalId: string } }).kaana?.hubUrl ?? "http://localhost:4100";
const TERMINAL = (window as unknown as { kaana?: { terminalId: string } }).kaana?.terminalId ?? "pos-1";

export async function hub<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${HUB}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) throw new Error(`Hub error: ${res.status}`);
  return res.json();
}

export function getTerminalId() { return TERMINAL; }

export async function getHubHealth() {
  return hub<{ cloudConnected: boolean; pendingSyncCount: number }>("/hub/health");
}
