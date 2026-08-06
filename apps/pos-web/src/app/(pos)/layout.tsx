"use client";

import { Suspense } from "react";
import { PosAuthGuard } from "@/components/pos/PosAuthGuard";
import { PosShell } from "@/components/pos/PosShell";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <PosAuthGuard>
        <PosShell>{children}</PosShell>
      </PosAuthGuard>
    </Suspense>
  );
}
