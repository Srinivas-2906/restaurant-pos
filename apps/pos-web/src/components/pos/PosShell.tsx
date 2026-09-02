"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { KaanaBrand } from "@kaana/ui";
import { getPosNavForRoles, OPERATIONS_WEB_URL, resolveAllRoles, resolvePrimaryRole, type UserRole } from "@kaana/role-shells";
import {
  api,
  fetchTerminalMe,
  getAuthMode,
  getOperationalStaff,
  getTerminalCredential,
  getUser,
  getOutletId,
  logoutSession,
} from "@/lib/api";

export function PosShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = getUser();
  const operationalStaff = getOperationalStaff();
  const authMode = getAuthMode();
  const roles: UserRole[] = user
    ? resolveAllRoles(user)
    : operationalStaff
      ? [operationalStaff.role as UserRole]
      : [];
  const nav = getPosNavForRoles(roles);
  const primary = user ? resolvePrimaryRole(user) : operationalStaff?.role ?? "biller";
  const showOwnerLink = primary === "owner" || primary === "manager";
  const [outletName, setOutletName] = useState("");
  const [terminalLabel, setTerminalLabel] = useState("Counter terminal");
  const actingName =
    operationalStaff?.displayName ??
    (user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Staff");

  useEffect(() => {
    const outletId = getOutletId();
    if (outletId) {
      api<{ name: string }>(`/outlets/${outletId}`)
        .then((o) => setOutletName(o.name))
        .catch(() => setOutletName(""));
    }

    const credential = getTerminalCredential();
    if (credential) {
      fetchTerminalMe()
        .then((terminal) => setTerminalLabel(`${terminal.name} (${terminal.code})`))
        .catch(() => setTerminalLabel("Counter terminal"));
    }
  }, []);

  return (
    <div className="min-h-dvh bg-surface flex flex-col pb-[env(safe-area-inset-bottom)]">
      <header className="bg-sidebar text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-5 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <KaanaBrand size="xs" appLabel="POS · Billing" />
            <div className="hidden sm:block min-w-0">
              <p className="text-white/50 text-[11px] truncate">
                {outletName ? `${outletName} · ${terminalLabel}` : terminalLabel}
              </p>
            </div>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "bg-sidebar-active text-white"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm shrink-0">
          {showOwnerLink && authMode === "email" && (
            <a href={OPERATIONS_WEB_URL + "/overview"} className="text-white/70 hover:text-white hidden md:inline">
              Owner console →
            </a>
          )}
          <span className="text-white/80 hidden md:inline">{actingName}</span>
          <button
            type="button"
            onClick={() => {
              logoutSession();
              window.location.href = "/";
            }}
            className="text-white/60 hover:text-white text-xs border border-white/20 rounded-lg px-2 py-1"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="h-1 bg-gradient-to-r from-kaana via-orange-500 to-kaana-dark shrink-0" aria-hidden />
      <div className="sm:hidden flex gap-1 px-2 py-2 bg-white border-b overflow-x-auto">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
              pathname === item.href || pathname.startsWith(`${item.href}/`)
                ? "bg-sidebar text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <main className="flex-1 min-h-0 overflow-auto">{children}</main>
    </div>
  );
}
