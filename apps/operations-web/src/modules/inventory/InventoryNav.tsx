"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/inventory", label: "Overview", exact: true },
  { href: "/inventory/materials", label: "Materials" },
  { href: "/inventory/recipes", label: "Recipes" },
  { href: "/inventory/suppliers", label: "Suppliers" },
  { href: "/inventory/movements", label: "Movements" },
  { href: "/inventory/transfers", label: "Transfers" },
];

export function InventoryNav() {
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
