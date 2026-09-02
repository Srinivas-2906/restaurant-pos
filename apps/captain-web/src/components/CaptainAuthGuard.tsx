"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HQ_ADMIN_URL, resolvePrimaryRole } from "@kaana/role-shells";
import { getUser, logout } from "@/lib/api";

export function CaptainAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

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
      window.location.href = `${HQ_ADMIN_URL}/dashboard`;
      return;
    }

    if (primary !== "captain") {
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
