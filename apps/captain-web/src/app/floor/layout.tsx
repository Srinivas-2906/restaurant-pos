"use client";

import { Suspense } from "react";
import { CaptainAuthGuard } from "@/components/CaptainAuthGuard";

export default function CaptainFloorLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface">Loading…</div>}>
      <CaptainAuthGuard>{children}</CaptainAuthGuard>
    </Suspense>
  );
}
