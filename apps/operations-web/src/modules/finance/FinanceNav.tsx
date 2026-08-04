"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/finance", label: "Sales" },
  { href: "/finance/gst", label: "GST Export" },
  { href: "/finance/reconciliation", label: "Reconciliation" },
  { href: "/finance/payroll", label: "Payroll" },
];

export function FinanceNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            pathname === t.href
              ? "bg-sidebar text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:border-sidebar-active hover:text-sidebar-active"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
