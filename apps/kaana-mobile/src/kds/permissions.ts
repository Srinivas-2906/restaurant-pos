import type { KdsQueueKot } from "@kaana/api-client";
import { getPermissionsFromToken, getRolesFromToken } from "@kaana/api-client";
import { isModuleEnabled, type CapabilityBootstrapPayload } from "@kaana/shared-types";

export type KdsColumn = "new" | "preparing" | "ready";

export function resolveKdsPermissions(
  accessToken: string,
  capabilities: CapabilityBootstrapPayload | null,
) {
  const permissions = getPermissionsFromToken(accessToken);
  const roles = getRolesFromToken(accessToken);
  const kdsEnabled = capabilities ? isModuleEnabled(capabilities, "kds") : false;

  const canAccessKds =
    kdsEnabled &&
    (roles.includes("chef") ||
      permissions.includes("access_kds") ||
      permissions.includes("manage_kot"));

  return {
    permissions,
    roles,
    kdsEnabled,
    canAccessKds,
    canBumpTickets: canAccessKds && permissions.includes("manage_kot"),
  };
}

export type KdsPermissions = ReturnType<typeof resolveKdsPermissions>;

export function columnForKotStatus(status: string): KdsColumn | null {
  if (status === "pending") return "new";
  if (status === "preparing") return "preparing";
  if (status === "ready") return "ready";
  return null;
}

export function partitionKotsByColumn(kots: KdsQueueKot[]) {
  const columns: Record<KdsColumn, KdsQueueKot[]> = {
    new: [],
    preparing: [],
    ready: [],
  };
  for (const kot of kots) {
    const col = columnForKotStatus(kot.status);
    if (col) columns[col].push(kot);
  }
  return columns;
}

export function orderContextLabel(kot: KdsQueueKot): string {
  const table = kot.order.table?.number;
  if (table) return `TABLE ${table}`;
  const type = (kot.order.type ?? "takeaway").replace(/_/g, " ").toUpperCase();
  return type;
}

export function isOrderFullyReady(kots: KdsQueueKot[]): boolean {
  if (kots.length === 0) return false;
  return kots.every((k) => k.status === "ready" || k.status === "served");
}

export function isOrderPartialReady(kots: KdsQueueKot[]): boolean {
  const hasReady = kots.some((k) => k.status === "ready");
  const hasActive = kots.some((k) => k.status === "pending" || k.status === "preparing");
  return hasReady && hasActive;
}
