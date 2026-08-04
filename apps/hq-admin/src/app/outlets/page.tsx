"use client";

import { useEffect } from "react";
import { redirectUrlForRole } from "@kaana/role-shells";

export default function LegacyRedirect() {
  useEffect(() => { window.location.href = redirectUrlForRole("owner"); }, []);
  return null;
}
