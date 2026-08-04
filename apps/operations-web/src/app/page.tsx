"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { getAppEntryForRole, redirectUrlForRole, resolvePrimaryRole } from "@kaana/role-shells";
import { login } from "@/lib/api";

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
      if (role === "super_admin") {
        window.location.href = redirectUrlForRole("super_admin");
        return;
      }
      if (role === "biller" || role === "captain" || role === "chef") {
        window.location.href = redirectUrlForRole(role);
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
            <p className="text-white/60 text-sm">RESTAURANT OPERATIONS</p>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Run your restaurant<br />from one console.
          </h2>
          <p className="text-white/70 max-w-md">
            Inventory, orders, finance, staff, and reports — unified for owners, managers, and back-office teams.
          </p>
        </div>
        <p className="text-white/40 text-sm">© Kaana Foods</p>
      </div>

      <div className="flex-1 flex items-center justify-center bg-surface p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-kaana flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <p className="font-bold text-gray-900">Kaana Operations</p>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-gray-500 mb-8">Sign in to your operations console</p>

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
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
