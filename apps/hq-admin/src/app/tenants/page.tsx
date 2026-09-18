"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getUser } from "@/lib/api";
import { PlatformNav } from "@/components/PlatformNav";
import Link from "next/link";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  operatingMode: string;
  subscriptionPlan: string;
  configVersion: number;
  outletCount: number;
  enabledModulesSummary: string;
  lastActivityAt: string;
  owner: { name: string; email: string; lastLoginAt: string | null } | null;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const path = query.trim() ? `/platform/tenants?q=${encodeURIComponent(query.trim())}` : "/platform/tenants";
    api<TenantRow[]>(path)
      .then(setTenants)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query]);

  const subtitle = useMemo(() => {
    if (loading) return "Loading…";
    return `${tenants.length} restaurant${tenants.length === 1 ? "" : "s"}`;
  }, [loading, tenants.length]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PlatformNav />
      <main className="p-6 max-w-6xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold">Restaurants / Tenants</h2>
            <p className="text-gray-500 text-sm mt-1">Cross-restaurant product configuration · {subtitle}</p>
          </div>
          <p className="text-sm text-gray-500">{getUser()?.email}</p>
        </div>

        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, slug, or owner email…"
            className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-red-600 mb-4">{error}</p>}

        {!error && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Restaurant</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Outlets</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Modules</th>
                  <th className="px-4 py-3 font-medium">Config</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      Loading tenants…
                    </td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      No restaurants match your search.
                    </td>
                  </tr>
                ) : (
                  tenants.map((t) => (
                    <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-500">{t.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            t.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {t.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {t.owner ? (
                          <>
                            <p className="text-gray-900">{t.owner.name || "—"}</p>
                            <p className="text-xs text-gray-500">{t.owner.email}</p>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{t.outletCount}</td>
                      <td className="px-4 py-3">{t.operatingMode}</td>
                      <td className="px-4 py-3">{t.subscriptionPlan}</td>
                      <td className="px-4 py-3 max-w-[180px] truncate text-xs text-gray-600" title={t.enabledModulesSummary}>
                        {t.enabledModulesSummary || "—"}
                      </td>
                      <td className="px-4 py-3">v{t.configVersion}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/tenants/${t.id}`} className="text-orange-600 hover:underline font-medium">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
