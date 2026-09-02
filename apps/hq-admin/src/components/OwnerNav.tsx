"use client";

import { KaanaBrand } from "@kaana/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUser, logout } from "@/lib/api";
import { useRouter } from "next/navigation";

const NAV = [
  { href: "/command-center", label: "Command Center" },
  { href: "/profitability", label: "Profitability" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/alerts", label: "Alerts" },
  { href: "/outlets", label: "Outlets" },
  { href: "/devices", label: "Devices" },
  { href: "/dashboard", label: "Legacy Dashboard" },
];

export function OwnerNav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();

  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 overflow-x-clip">
      <div className="flex items-center gap-4 min-w-0 flex-wrap">
        <KaanaBrand size="xs" framed appLabel="Owner Console" labelClassName="text-gray-500" />
        <div className="hidden lg:flex items-center gap-4">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}
            className={pathname === n.href ? "text-gray-900 font-medium" : "text-gray-700 hover:text-gray-900"}>
            {n.label}
          </Link>
        ))}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{user?.firstName} {user?.lastName}</span>
        <button onClick={() => { logout(); router.push("/"); }} className="text-sm text-red-600 hover:underline">Logout</button>
      </div>
    </nav>
  );
}
