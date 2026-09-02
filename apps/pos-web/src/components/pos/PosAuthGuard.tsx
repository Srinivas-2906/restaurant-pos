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
  usesPosApp,
} from "@kaana/role-shells";
import {
  getAuthMode,
  getOperationalStaff,
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

    if (!usesPosApp(primary) && primary !== "owner" && primary !== "manager") {
      logoutSession();
      router.replace("/");
      return;
    }

    const roles = resolveAllRoles(user);
    if (!canAccessPosRoute(roles, pathname)) {
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
