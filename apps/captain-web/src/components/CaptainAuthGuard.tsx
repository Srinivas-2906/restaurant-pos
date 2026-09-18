"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HQ_ADMIN_URL } from "@kaana/role-shells";
import { APP_ACCESS, hasSessionAppAccess } from "@kaana/shared-types";
import {
  getPermissionsFromSession,
  getRolesFromSession,
  getUser,
  hasValidSession,
  logout,
} from "@/lib/api";

export function CaptainAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hasValidSession()) {
      router.replace("/");
      return;
    }

    const perms = getPermissionsFromSession();
    const roles = getRolesFromSession();
    if (roles.includes("super_admin")) {
      window.location.href = `${HQ_ADMIN_URL}/dashboard`;
      return;
    }

    if (!hasSessionAppAccess(perms, roles, APP_ACCESS.access_captain)) {
      logout();
      router.replace("/");
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-slate-500">
        Loading floor…
      </div>
    );
  }

  return <>{children}</>;
}
