"use client";

import { useEffect } from "react";
import { ensureOutletSelected } from "@/lib/api";

export function OutletBootstrap() {
  useEffect(() => {
    ensureOutletSelected().catch(() => {});
  }, []);

  return null;
}
