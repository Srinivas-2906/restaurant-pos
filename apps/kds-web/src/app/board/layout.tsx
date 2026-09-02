"use client";

import { Suspense } from "react";
import { KdsAuthGuard } from "@/components/KdsAuthGuard";

export default function KdsBoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface">Loading…</div>}>
      <KdsAuthGuard>{children}</KdsAuthGuard>
    </Suspense>
  );
}
