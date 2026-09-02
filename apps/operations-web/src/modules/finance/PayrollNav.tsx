"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/payroll", label: "Overview", exact: true },
  { href: "/payroll/runs", label: "Payroll Runs" },
  { href: "/payroll/structures", label: "Salary Structures" },
  { href: "/payroll/adjustments", label: "Adjustments" },
  { href: "/payroll/statutory", label: "Statutory Deductions" },
  { href: "/payroll/loans", label: "Loans & Advances" },
  { href: "/payroll/bonus", label: "Bonus & Incentives" },
  { href: "/payroll/settlements", label: "Final Settlements" },
  { href: "/payroll/payments", label: "Payments" },
  { href: "/payroll/reports", label: "Reports" },
  { href: "/payroll/settings", label: "Settings" },
];

export function PayrollNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {TABS.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname === t.href || pathname.startsWith(`${t.href}/`);
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
