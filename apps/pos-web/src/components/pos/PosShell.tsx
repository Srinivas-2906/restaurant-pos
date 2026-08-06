"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPosNavForRoles, LOGIN_PORTAL_URL, OPERATIONS_WEB_URL, resolveAllRoles, resolvePrimaryRole } from "@kaana/role-shells";
import { getUser, logout } from "@/lib/api";

export function PosShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = getUser();
  const roles = user ? resolveAllRoles(user) : [];
  const nav = getPosNavForRoles(roles);
  const primary = user ? resolvePrimaryRole(user) : "biller";
  const showOwnerLink = primary === "owner" || primary === "manager";

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="bg-sidebar text-white px-4 py-2.5 flex items-center justify-between gap-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-5 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-sm">K</div>
            <div>
              <p className="font-semibold text-sm leading-tight">Kaana POS</p>
              <p className="text-white/50 text-[11px]">Counter terminal</p>
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
          {showOwnerLink && (
            <a href={OPERATIONS_WEB_URL + "/overview"} className="text-white/70 hover:text-white hidden md:inline">
              Owner console →
            </a>
          )}
          <span className="text-white/80 hidden md:inline">
            {user?.firstName} {user?.lastName}
          </span>
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = LOGIN_PORTAL_URL;
            }}
            className="text-white/60 hover:text-white text-xs border border-white/20 rounded-lg px-2 py-1"
          >
            Sign out
          </button>
        </div>
      </header>
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
