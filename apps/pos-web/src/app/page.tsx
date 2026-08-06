"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAppEntryForRole, getLoginPortalUrl, resolvePrimaryRole } from "@kaana/role-shells";
import { getUser } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = getUser();
    if (!token || !user) {
      window.location.href = getLoginPortalUrl(window.location.origin);
      return;
    }
    router.replace(getAppEntryForRole(resolvePrimaryRole(user)));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-400">
      Redirecting…
    </div>
  );
}
