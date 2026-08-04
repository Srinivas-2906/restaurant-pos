import type { UserRole } from "@kaana/role-shells";
import { canAccessRoute, resolveAllRoles } from "@kaana/role-shells";
import { getUser } from "./api";

export function getUserRoles(): UserRole[] {
  const user = getUser();
  return user ? resolveAllRoles(user) : [];
}

export function userCanAccess(pathname: string): boolean {
  return canAccessRoute(getUserRoles(), pathname);
}
