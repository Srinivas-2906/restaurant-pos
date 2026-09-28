export function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function resolveApiUrl(envApiUrl?: string) {
  const raw = trimSlash(envApiUrl || "http://localhost:4000/api");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

export function resolveWsUrl(envApiUrl?: string, envWsUrl?: string) {
  if (envWsUrl) return trimSlash(envWsUrl);
  return `${resolveApiUrl(envApiUrl).replace(/\/api$/, "")}/events`;
}
