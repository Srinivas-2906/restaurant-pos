"use client";

import type { ReactNode } from "react";
import { KaanaBrand } from "@kaana/ui";

export type RoleVariant = "kds" | "captain";

const THEMES: Record<
  RoleVariant,
  {
    accentBar: string;
    logo: string;
    badge: string;
    hint: string;
    page: string;
  }
> = {
  kds: {
    accentBar: "h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 shrink-0",
    logo: "bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-600/25 ring-2 ring-amber-300/30",
    badge: "bg-amber-500/25 text-amber-100 border border-amber-400/50",
    hint: "bg-gradient-to-r from-amber-50 to-orange-50/80 border-b border-amber-200/80 border-l-4 border-l-amber-500 text-amber-950/80",
    page: "bg-[linear-gradient(165deg,#fffbf5_0%,#f4f6f5_45%,#f4f6f5_100%)]",
  },
  captain: {
    accentBar: "h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 shrink-0",
    logo: "bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-600/25 ring-2 ring-teal-300/30",
    badge: "bg-teal-500/25 text-teal-50 border border-teal-400/50",
    hint: "bg-gradient-to-r from-teal-50 to-emerald-50/80 border-b border-teal-200/80 border-l-4 border-l-teal-500 text-teal-950/80",
    page: "bg-[linear-gradient(165deg,#f5fdfa_0%,#f4f6f5_45%,#f4f6f5_100%)]",
  },
};

export function RoleAppShell({
  variant,
  title,
  badge,
  subtitle,
  trailing,
  hint,
  children,
}: {
  variant: RoleVariant;
  title: string;
  badge?: string;
  subtitle?: string;
  trailing?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  const theme = THEMES[variant];

  return (
    <div className={`min-h-dvh flex flex-col ${theme.page} pb-[env(safe-area-inset-bottom)]`}>
      <header className="bg-sidebar text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <KaanaBrand size="xs" appLabel={badge ? `${title} · ${badge}` : title} labelClassName="text-white/70" />
          {subtitle && <p className="text-white/50 text-xs truncate hidden sm:block border-l border-white/15 pl-3">{subtitle}</p>}
        </div>
        {trailing && <div className="text-sm">{trailing}</div>}
      </header>
      <div className={theme.accentBar} aria-hidden />
      {hint && <div className={`px-5 py-2.5 text-sm shrink-0 ${theme.hint}`}>{hint}</div>}
      <main className="flex-1 min-h-0 overflow-auto">{children}</main>
    </div>
  );
}
