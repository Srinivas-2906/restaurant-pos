"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { redirectUrlForRole } from "@kaana/role-shells";

/** Redirect legacy owner routes to operations-web */
export default function LegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    window.location.href = redirectUrlForRole("owner");
  }, [router]);
  return <p className="p-6 text-gray-500">Redirecting to Kaana Operations...</p>;
}
