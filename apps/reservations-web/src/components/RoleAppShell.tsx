"use client";

import type { ReactNode } from "react";
import { KaanaBrand } from "@kaana/ui";

const THEME = {
  accentBar: "h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-400 shrink-0",
  hint: "bg-gradient-to-r from-violet-50 to-indigo-50/80 border-b border-violet-200/80 border-l-4 border-l-violet-500 text-violet-950/80",
  page: "bg-[linear-gradient(165deg,#faf5ff_0%,#f4f6f5_45%,#f4f6f5_100%)]",
};

export function RoleAppShell({
  title,
  badge,
  subtitle,
  trailing,
  hint,
  children,
}: {
  title: string;
  badge?: string;
  subtitle?: string;
  trailing?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-h-dvh flex flex-col ${THEME.page} pb-[env(safe-area-inset-bottom)]`}>
      <header className="bg-sidebar text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <KaanaBrand size="xs" appLabel={badge ? `${title} · ${badge}` : title} />
          {subtitle && <p className="text-white/50 text-[11px] truncate hidden sm:block">{subtitle}</p>}
        </div>
        {trailing && <div className="text-sm shrink-0">{trailing}</div>}
      </header>
      <div className={THEME.accentBar} aria-hidden />
      {hint && <div className={`px-5 py-2.5 text-sm shrink-0 ${THEME.hint}`}>{hint}</div>}
      <main className="flex-1 min-h-0 overflow-auto">{children}</main>
    </div>
  );
}
