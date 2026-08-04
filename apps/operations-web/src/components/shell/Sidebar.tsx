"use client";

import { getNavForRoles } from "@kaana/role-shells";
import { getUser, logout } from "@/lib/api";
import { getRolesForNav } from "@/components/AuthGuard";
import { NavItem } from "./NavItem";
import { ChevronDown, UtensilsCrossed } from "lucide-react";
import { useRouter } from "next/navigation";

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const router = useRouter();
  const user = getUser();
  const nav = getNavForRoles(getRolesForNav());

  const content = (
    <>
      <div className="px-5 py-6 flex items-center gap-3 border-b border-white/10">
        <div className="w-10 h-10 rounded-full bg-kaana flex items-center justify-center shrink-0">
          <UtensilsCrossed className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">KAANA</p>
          <p className="text-white/60 text-xs">RESTAURANT</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {nav.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            moduleId={item.id}
            onNavigate={onClose}
          />
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full bg-sidebar-active flex items-center justify-center text-white text-sm font-semibold">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-white/50 text-xs truncate">{getRolesForNav()[0]?.replace("_", " ") ?? "User"}</p>
          </div>
          <button
            type="button"
            onClick={() => { logout(); router.push("/"); }}
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
