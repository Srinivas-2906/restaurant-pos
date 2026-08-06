"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import {
  getAppEntryForRole,
  redirectUrlForRoleWithAuth,
  resolvePrimaryRole,
  usesPosApp,
} from "@kaana/role-shells";
import { login, setSelectedOutletId } from "@/lib/api";

function getOutletIdFromUser(user: { roles?: Array<{ outletId?: string | null }> }) {
  return user.roles?.find((r) => r.outletId)?.outletId ?? user.roles?.[0]?.outletId ?? null;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@kaanafoods.in");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(email, password);
      const role = resolvePrimaryRole(data.user);
      const outletId = getOutletIdFromUser(data.user);
      if (outletId) setSelectedOutletId(outletId);

      const handoff = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
        outletId,
      };

      if (role === "super_admin" || usesPosApp(role) || role === "captain" || role === "chef") {
        window.location.href = redirectUrlForRoleWithAuth(role, handoff);
        return;
      }

      router.push(getAppEntryForRole(role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-kaana flex items-center justify-center">
            <UtensilsCrossed className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-xl">KAANA</p>
            <p className="text-white/60 text-sm">ONE LOGIN FOR YOUR RESTAURANT</p>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            POS, inventory, payroll<br />— one place to sign in.
          </h2>
          <p className="text-white/70 max-w-md">
            Counter staff go to POS. Owners manage payroll and reports here. No separate logins to remember.
          </p>
          <ul className="mt-6 space-y-2 text-white/60 text-sm">
            <li>• Biller / storekeeper → POS (counter + inventory)</li>
            <li>• Owner / accountant → Owner console (payroll, staff, reports)</li>
          </ul>
        </div>
        <p className="text-white/40 text-sm">© Kaana Foods</p>
      </div>

      <div className="flex-1 flex items-center justify-center bg-surface p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-kaana flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <p className="font-bold text-gray-900">Kaana</p>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Sign in</h1>
          <p className="text-gray-500 mb-8">We&apos;ll take you to the right app automatically</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-kaana/30 focus:border-kaana"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-kaana/30 focus:border-kaana"
                required
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-kaana hover:bg-kaana-dark text-white py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
