"use client";

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
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold text-orange-600">Kaana Owner</h1>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}
            className={pathname === n.href ? "text-orange-600 font-medium" : "text-gray-700 hover:text-orange-600"}>
            {n.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{user?.firstName} {user?.lastName}</span>
        <button onClick={() => { logout(); router.push("/"); }} className="text-sm text-red-600 hover:underline">Logout</button>
      </div>
    </nav>
  );
}
