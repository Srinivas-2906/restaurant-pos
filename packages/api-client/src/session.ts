import type { JwtPayload } from "@kaana/shared-types";

export interface StoredAuthUser {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  roles?: Array<{ role: string; outletId?: string | null }>;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    return JSON.parse(atob(token.split(".")[1] ?? "")) as JwtPayload;
  } catch {
    return null;
  }
}

export function isAccessTokenExpired(token: string, skewSeconds = 60): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() >= (payload.exp - skewSeconds) * 1000;
  } catch {
    return true;
  }
}

export function getAuthModeFromToken(token: string | null): "email" | "operational" | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (payload?.authMode === "operational") return "operational";
  if (payload?.authMode === "email") return "email";
  return "email";
}

export function getPermissionsFromToken(token: string | null): string[] {
  if (!token) return [];
  return decodeJwtPayload(token)?.permissions ?? [];
}

export function getRolesFromToken(token: string | null): string[] {
  if (!token) return [];
  const payload = decodeJwtPayload(token);
  if (payload?.roles?.length) return payload.roles;
  return payload?.role ? [payload.role] : [];
}

export function getOutletIdFromUser(user: StoredAuthUser | null): string | null {
  return user?.roles?.find((r) => r.outletId)?.outletId ?? user?.roles?.[0]?.outletId ?? null;
}
