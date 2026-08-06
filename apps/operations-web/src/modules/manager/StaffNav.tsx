"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/staff", label: "Team", exact: true },
  { href: "/staff/attendance", label: "Attendance" },
  { href: "/staff/shifts", label: "Shifts" },
  { href: "/staff/leaves", label: "Leaves" },
  { href: "/staff/masters", label: "Masters" },
];

export function StaffNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              active
                ? "bg-sidebar text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:border-sidebar-active hover:text-sidebar-active"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
