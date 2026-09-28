"use client";

import type { ReactNode } from "react";
import { KaanaBrand } from "./KaanaLogo";

export type RoleShellVariant = "kds" | "captain" | "reservations";

const THEMES: Record<
  RoleShellVariant,
  {
    accentBar: string;
    hint: string;
    page: string;
  }
> = {
  kds: {
    accentBar: "h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 shrink-0",
    hint: "bg-gradient-to-r from-amber-50 to-orange-50/80 border-b border-amber-200/80 border-l-4 border-l-amber-500 text-amber-950/80",
    page: "bg-[linear-gradient(165deg,#fffbf5_0%,#f4f6f5_45%,#f4f6f5_100%)]",
  },
  captain: {
    accentBar: "h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 shrink-0",
    hint: "bg-gradient-to-r from-teal-50 to-emerald-50/80 border-b border-teal-200/80 border-l-4 border-l-teal-500 text-teal-950/80",
    page: "bg-[linear-gradient(165deg,#f5fdfa_0%,#f4f6f5_45%,#f4f6f5_100%)]",
  },
  reservations: {
    accentBar: "h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-400 shrink-0",
    hint: "bg-gradient-to-r from-violet-50 to-indigo-50/80 border-b border-violet-200/80 border-l-4 border-l-violet-500 text-violet-950/80",
    page: "bg-[linear-gradient(165deg,#faf5ff_0%,#f4f6f5_45%,#f4f6f5_100%)]",
  },
};

export function RoleAppShell({
  variant = "captain",
  title,
  badge,
  subtitle,
  trailing,
  hint,
  children,
}: {
  variant?: RoleShellVariant;
  title: string;
  badge?: string;
  subtitle?: string;
  trailing?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  const theme = THEMES[variant];
  const appLabel = badge ? `${title} · ${badge}` : title;

  return (
    <div className={`min-h-dvh flex flex-col ${theme.page} pb-[env(safe-area-inset-bottom)]`}>
      <header className="bg-sidebar text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <KaanaBrand size="xs" appLabel={appLabel} labelClassName="text-white/70" />
          {subtitle && (
            <p className="text-white/50 text-[11px] truncate hidden sm:block border-l border-white/15 pl-3">
              {subtitle}
            </p>
          )}
        </div>
        {trailing && <div className="text-sm shrink-0">{trailing}</div>}
      </header>
      <div className={theme.accentBar} aria-hidden />
      {hint && <div className={`px-5 py-2.5 text-sm shrink-0 ${theme.hint}`}>{hint}</div>}
      <main className="flex-1 min-h-0 overflow-auto">{children}</main>
    </div>
  );
}
