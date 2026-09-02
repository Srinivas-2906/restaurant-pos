"use client";

import { KaanaBrand } from "@kaana/ui";
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
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 overflow-x-clip">
      <div className="flex items-center gap-4 min-w-0 flex-wrap">
        <KaanaBrand size="xs" framed appLabel="Platform Admin" labelClassName="text-gray-500" />
        <div className="hidden md:flex items-center gap-4">
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
        <button type="button" onClick={() => { logout(); router.push("/"); }} className="text-sm text-red-600 hover:underline">Logout</button>
      </div>
    </nav>
  );
}
