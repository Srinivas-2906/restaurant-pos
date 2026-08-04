"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getUser, logout } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tenants", label: "Tenants" },
  { href: "/users", label: "Users" },
  { href: "/support", label: "Support" },
];

export function PlatformNav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold text-orange-600">Kaana Platform Admin</h1>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}
            className={pathname === n.href ? "text-orange-600 font-medium" : "text-gray-700 hover:text-orange-600"}>
            {n.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{user?.firstName} {user?.lastName}</span>
        <button type="button" onClick={() => { logout(); router.push("/"); }} className="text-sm text-red-600 hover:underline">Logout</button>
      </div>
    </nav>
  );
}
