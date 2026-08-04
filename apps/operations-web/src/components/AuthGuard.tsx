"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAppEntryForRole, redirectUrlForRole, resolvePrimaryRole, resolveAllRoles } from "@kaana/role-shells";
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
      window.location.href = redirectUrlForRole("super_admin");
      return;
    }
    if (primary === "biller" || primary === "captain" || primary === "chef") {
      window.location.href = redirectUrlForRole(primary);
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
