import type { ScopedAuthUser } from "./outlet-scope.service";

export type AuditActorContext = {
  userId?: string;
  staffProfileId?: string;
  terminalId?: string;
  employeeCode?: string;
  displayName?: string;
  authMode?: "email" | "operational";
  role?: string;
};

export function auditActorFromUser(user: ScopedAuthUser): AuditActorContext {
  return {
    userId: user.authMode === "operational" ? undefined : user.userId,
    staffProfileId: user.staffProfileId,
    terminalId: user.terminalId,
    displayName: user.displayName,
    authMode: user.authMode ?? "email",
    role: user.role,
  };
}

export function operationalAuditMetadata(
  actor?: AuditActorContext,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(extra ?? {}) };
  if (!actor) return base;

  if (actor.authMode === "operational") {
    if (actor.staffProfileId) base.staffProfileId = actor.staffProfileId;
    if (actor.terminalId) base.terminalId = actor.terminalId;
    if (actor.employeeCode) base.employeeCode = actor.employeeCode;
    if (actor.displayName) base.staffDisplayName = actor.displayName;
    base.authMode = "operational";
    if (actor.role) base.role = actor.role;
  } else if (actor.userId) {
    base.authMode = "email";
    if (actor.role) base.role = actor.role;
  }

  return base;
}
