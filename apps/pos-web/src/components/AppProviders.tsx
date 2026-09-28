"use client";

import { useEffect } from "react";
import { AppToaster } from "@kaana/ui";
import { startPosOfflineSyncLoop } from "@/lib/offline-sync";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/+$/, "");

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    return startPosOfflineSyncLoop(API_BASE, () =>
      typeof window !== "undefined" ? localStorage.getItem("token") : null,
    );
  }, []);

  return (
    <>
      {children}
      <AppToaster />
    </>
  );
}
