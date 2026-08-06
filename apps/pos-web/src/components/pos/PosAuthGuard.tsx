"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  applyAuthHandoffFromSearchParams,
  canAccessPosRoute,
  getAppEntryForRole,
  getLoginPortalUrl,
  redirectUrlForRoleWithAuth,
  resolveAllRoles,
  resolvePrimaryRole,
  readAuthHandoffFromStorage,
  usesPosApp,
} from "@kaana/role-shells";
import { getUser } from "@/lib/api";

export function PosAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (applyAuthHandoffFromSearchParams(searchParams)) {
      const clean = pathname + (searchParams.get("outletId") ? `?outletId=${searchParams.get("outletId")}` : "");
      router.replace(clean);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = getLoginPortalUrl(window.location.origin);
      return;
    }

    const user = getUser();
    if (!user) {
      window.location.href = getLoginPortalUrl(window.location.origin);
      return;
    }

    const primary = resolvePrimaryRole(user);
    if (primary === "super_admin") {
      const handoff = readAuthHandoffFromStorage();
      if (handoff) window.location.href = redirectUrlForRoleWithAuth("super_admin", handoff);
      return;
    }

    if (!usesPosApp(primary) && primary !== "owner" && primary !== "manager") {
      const handoff = readAuthHandoffFromStorage();
      if (handoff) window.location.href = redirectUrlForRoleWithAuth(primary, handoff);
      return;
    }

    const roles = resolveAllRoles(user);
    if (!canAccessPosRoute(roles, pathname)) {
      router.replace(getAppEntryForRole(primary));
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
