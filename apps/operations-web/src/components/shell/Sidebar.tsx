"use client";

import { useEffect, useState } from "react";
import { getNavForRoles, type NavItem as RoleNavItem } from "@kaana/role-shells";
import { getUser, logout, type AuthUser } from "@/lib/api";
import { getRolesForNav } from "@/components/AuthGuard";
import { NavItem } from "./NavItem";
import { KaanaBrand } from "@kaana/ui";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [nav, setNav] = useState<RoleNavItem[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roleLabel, setRoleLabel] = useState("User");

  useEffect(() => {
    setNav(getNavForRoles(getRolesForNav()));
    setUser(getUser());
    setRoleLabel(getRolesForNav()[0]?.replace("_", " ") ?? "User");
    setMounted(true);
  }, []);

  const content = (
    <>
      <div className="px-5 py-5 border-b border-white/10 min-w-0">
        <KaanaBrand size="sm" appLabel="Owner Console" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {mounted
          ? nav.map((item) => (
              <NavItem
                key={item.id}
                href={item.href}
                label={item.label}
                moduleId={item.id}
                externalPos={item.externalPos}
                externalReservations={item.externalReservations}
                onNavigate={onClose}
              />
            ))
          : Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-white/5 animate-pulse mx-1" aria-hidden />
            ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full bg-sidebar-active flex items-center justify-center text-white text-sm font-semibold">
            {mounted ? `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}` : "·"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {mounted ? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "User" : "…"}
            </p>
            <p className="text-white/50 text-xs truncate">{mounted ? roleLabel : "…"}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="text-white/50 hover:text-white"
            title="Logout"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-sidebar shrink-0 bg-sidebar sticky top-0 h-screen z-40">
        {content}
      </aside>
      {mobileOpen && (
        <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-sidebar bg-sidebar flex flex-col shadow-2xl">
          {content}
        </aside>
      )}
    </>
  );
}
