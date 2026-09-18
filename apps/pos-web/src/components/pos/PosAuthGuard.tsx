"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  applyAuthHandoffFromSearchParams,
  canAccessPosRoute,
  getPosDeniedRedirect,
  HQ_ADMIN_URL,
  resolveAllRoles,
  resolvePrimaryRole,
  type UserRole,
} from "@kaana/role-shells";
import { APP_ACCESS, hasSessionAppAccess } from "@kaana/shared-types";
import {
  getAuthMode,
  getOperationalStaff,
  getPermissionsFromSession,
  getRolesFromSession,
  getUser,
  hasValidSession,
  logoutSession,
} from "@/lib/api";

function PosAuthGuardInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (searchParams) {
      applyAuthHandoffFromSearchParams(searchParams);
    }

    if (!hasValidSession()) {
      router.replace("/");
      return;
    }

    const authMode = getAuthMode();
    if (authMode === "operational") {
      const perms = getPermissionsFromSession();
      const roles = getRolesFromSession();
      if (!hasSessionAppAccess(perms, roles, APP_ACCESS.access_pos)) {
        logoutSession();
        router.replace("/");
        return;
      }
      setReady(true);
      return;
    }

    const user = getUser();
    if (!user) {
      router.replace("/");
      return;
    }

    const primary = resolvePrimaryRole(user);
    if (primary === "super_admin") {
      window.location.href = `${HQ_ADMIN_URL}/dashboard`;
      return;
    }

    const perms = getPermissionsFromSession();
    const roles = getRolesFromSession();
    const roleList = (roles.length ? roles : resolveAllRoles(user)) as UserRole[];

    if (
      !hasSessionAppAccess(perms, roleList, APP_ACCESS.access_pos) &&
      primary !== "owner" &&
      primary !== "manager"
    ) {
      logoutSession();
      router.replace("/");
      return;
    }
    if (!canAccessPosRoute(roleList, pathname)) {
      router.replace(getPosDeniedRedirect(primary));
      return;
    }

    setReady(true);
  }, [pathname, router, searchParams]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-300">
        Loading POS…
      </div>
    );
  }

  return <>{children}</>;
}

export function PosAuthGuard({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-300">
          Loading POS…
        </div>
      }
    >
      <PosAuthGuardInner>{children}</PosAuthGuardInner>
    </Suspense>
  );
}

export function useActingEmployeeName(): string {
  const operational = getOperationalStaff();
  if (operational?.displayName) return operational.displayName;
  const user = getUser();
  if (user) return `${user.firstName} ${user.lastName ?? ""}`.trim();
  return "Staff";
}
