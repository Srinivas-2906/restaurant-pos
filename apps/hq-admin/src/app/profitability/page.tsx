"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { redirectUrlForRole } from "@kaana/role-shells";

export default function LegacyRedirect() {
  useEffect(() => {
    window.location.href = redirectUrlForRole("owner");
  }, []);
  return null;
}
