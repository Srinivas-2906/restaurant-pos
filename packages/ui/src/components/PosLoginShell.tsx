"use client";

import type { ReactNode } from "react";
import { KaanaBrand } from "./KaanaLogo";

/** Dark device shell for terminal setup, PIN, and staff picker flows. */
export function PosLoginShell({
  terminalName,
  appLabel = "POS · Counter",
  children,
}: {
  terminalName?: string;
  appLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-gray-950 flex flex-col">
      <header className="px-4 sm:px-6 py-3 flex items-center gap-3 border-b border-white/10 shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <KaanaBrand size="sm" appLabel={appLabel} labelClassName="text-white/50" />
        <p className="text-xs text-white/40 truncate ml-auto hidden sm:block">
          {terminalName ? `Terminal · ${terminalName}` : "Counter terminal"}
        </p>
      </header>
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 safe-bottom">{children}</main>
    </div>
  );
}
