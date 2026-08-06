"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getAppEntryForRole,
  readAuthHandoffFromStorage,
  redirectUrlForRoleWithAuth,
  resolveAllRoles,
  resolvePrimaryRole,
  usesPosApp,
} from "@kaana/role-shells";
import { getUser } from "@/lib/api";
import { userCanAccess } from "@/lib/permissions";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/");
      return;
    }
    const user = getUser();
    if (!user) return;

    const primary = resolvePrimaryRole(user);
    if (primary === "super_admin") {
      const handoff = readAuthHandoffFromStorage();
      if (handoff) window.location.href = redirectUrlForRoleWithAuth("super_admin", handoff);
      return;
    }
    if (usesPosApp(primary)) {
      const handoff = readAuthHandoffFromStorage();
      if (handoff) window.location.href = redirectUrlForRoleWithAuth(primary, handoff);
      return;
    }
    if (primary === "biller" || primary === "captain" || primary === "chef") {
      const handoff = readAuthHandoffFromStorage();
      if (handoff) window.location.href = redirectUrlForRoleWithAuth(primary, handoff);
      return;
    }

    if (!userCanAccess(pathname)) {
      router.replace(getAppEntryForRole(primary));
    }
  }, [pathname, router]);

  return <>{children}</>;
}

export function getRolesForNav() {
  const user = getUser();
  return user ? resolveAllRoles(user) : [];
}
