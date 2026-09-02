"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { buildPosLink, buildReservationsLink, readAuthHandoffFromStorage } from "@kaana/role-shells";
import { getOutletId } from "@/lib/api";
import { getModuleIcon } from "./sidebar-config";

interface NavItemProps {
  href: string;
  label: string;
  moduleId: string;
  externalPos?: boolean;
  externalReservations?: boolean;
  onNavigate?: () => void;
}

export function NavItem({ href, label, moduleId, externalPos, externalReservations, onNavigate }: NavItemProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active =
    mounted &&
    !externalPos &&
    !externalReservations &&
    (pathname === href || pathname.startsWith(`${href}/`));

  const Icon = getModuleIcon(moduleId);

  if (externalPos || externalReservations) {
    return (
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          const handoff = readAuthHandoffFromStorage();
          if (!handoff) {
            window.location.href = "/";
            return;
          }
          const outletId = getOutletId();
          const payload = { ...handoff, outletId: outletId ?? handoff.outletId };
          window.location.href = externalReservations
            ? buildReservationsLink(href, payload)
            : buildPosLink(href, payload);
        }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-white/80 hover:bg-sidebar-hover hover:text-white"
      >
        <Icon className="w-5 h-5 shrink-0 opacity-90" />
        <span>{label}</span>
      </button>
    );
  }

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
