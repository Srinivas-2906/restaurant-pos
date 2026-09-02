"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAppEntryForRole, HQ_ADMIN_URL, resolveAllRoles, resolvePrimaryRole } from "@kaana/role-shells";
import { getUser, logout } from "@/lib/api";
import { userCanAccess } from "@/lib/permissions";

const ALLOWED_ROLES = new Set(["owner", "manager", "accountant"]);

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
    if (!user) {
      router.replace("/");
      return;
    }

    const primary = resolvePrimaryRole(user);
    if (primary === "super_admin") {
      window.location.href = `${HQ_ADMIN_URL}${getAppEntryForRole(primary)}`;
      return;
    }

    if (!ALLOWED_ROLES.has(primary)) {
      logout();
      router.replace("/");
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
