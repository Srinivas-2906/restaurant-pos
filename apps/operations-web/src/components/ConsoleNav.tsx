"use client";

import { KaanaBrand } from "@kaana/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getNavForRoles } from "@kaana/role-shells";
import { getUser, logout } from "@/lib/api";
import { getRolesForNav } from "./AuthGuard";
import { OutletSelector } from "./OutletSelector";

export function ConsoleNav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();
  const nav = getNavForRoles(getRolesForNav());

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-3 min-w-0">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap min-w-0">
          <Link href="/overview" className="shrink-0">
            <KaanaBrand size="xs" framed appLabel="Operations" labelClassName="text-gray-500" />
          </Link>
          <nav className="flex items-center gap-4 flex-wrap">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={
                  pathname === n.href || pathname.startsWith(`${n.href}/`)
                    ? "text-orange-600 font-medium text-sm"
                    : "text-gray-700 hover:text-orange-600 text-sm"
                }
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <OutletSelector />
          <span className="text-sm text-gray-600">{user?.firstName} {user?.lastName}</span>
          <button
            type="button"
            onClick={() => { logout(); router.push("/"); }}
            className="text-sm text-red-600 hover:underline"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
