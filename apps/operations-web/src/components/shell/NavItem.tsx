"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getModuleIcon } from "./sidebar-config";

interface NavItemProps {
  href: string;
  label: string;
  moduleId: string;
  onNavigate?: () => void;
}

export function NavItem({ href, label, moduleId, onNavigate }: NavItemProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const Icon = getModuleIcon(moduleId);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-sidebar-active text-white"
          : "text-white/80 hover:bg-sidebar-hover hover:text-white"
      }`}
    >
      <Icon className="w-5 h-5 shrink-0 opacity-90" />
      <span>{label}</span>
    </Link>
  );
}
