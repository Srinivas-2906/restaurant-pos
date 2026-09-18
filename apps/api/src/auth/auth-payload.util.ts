import {
  JwtPayload,
  mergePermissionsFromAssignments,
  resolveEffectivePermissions,
  type Permission,
} from "@kaana/shared-types";

type RoleAssignmentLike = {
  role: string;
  outletId?: string | null;
  permissions?: unknown;
};

export function pickPrimaryRoleAssignment<T extends RoleAssignmentLike>(
  assignments: T[],
): T | undefined {
  return assignments.find((a) => a.outletId) ?? assignments[0];
}

export function collectRoleNames(assignments: RoleAssignmentLike[]): string[] {
  return [...new Set(assignments.map((a) => a.role).filter(Boolean))];
}

export function buildEmailJwtPayload(input: {
  userId: string;
  email: string;
  organizationId: string;
  roleAssignments: RoleAssignmentLike[];
  staffRoleAssignments?: RoleAssignmentLike[];
  staffProfileId?: string;
  outletIdOverride?: string;
}): JwtPayload {
  const primary = pickPrimaryRoleAssignment(input.roleAssignments);
  const userPermissions = mergePermissionsFromAssignments(input.roleAssignments);
  const staffPermissions = input.staffRoleAssignments
    ? mergePermissionsFromAssignments(input.staffRoleAssignments)
    : [];
  const permissions: Permission[] = [...new Set([...userPermissions, ...staffPermissions])];
  const roles = collectRoleNames([
    ...input.roleAssignments,
    ...(input.staffRoleAssignments ?? []),
  ]);

  return {
    sub: input.userId,
    userId: input.userId,
    email: input.email,
    organizationId: input.organizationId,
    outletId: input.outletIdOverride ?? primary?.outletId ?? undefined,
    role: primary?.role,
    roles: roles.length > 0 ? roles : primary?.role ? [primary.role] : undefined,
    authMode: "email",
    staffProfileId: input.staffProfileId,
    permissions,
  };
}

export function buildOperationalJwtPayload(input: {
  staffProfileId: string;
  userId?: string;
  organizationId: string;
  outletId: string;
  terminalId: string;
  roleAssignments: RoleAssignmentLike[];
  displayName: string;
  primaryRole: string;
}): JwtPayload {
  const permissions = mergePermissionsFromAssignments(input.roleAssignments);
  const roles = collectRoleNames(input.roleAssignments);

  return {
    sub: input.userId ?? input.staffProfileId,
    userId: input.userId,
    organizationId: input.organizationId,
    outletId: input.outletId,
    terminalId: input.terminalId,
    staffProfileId: input.staffProfileId,
    role: input.primaryRole,
    roles: roles.length > 0 ? roles : [input.primaryRole],
    authMode: "operational",
    permissions,
    displayName: input.displayName,
  };
}
