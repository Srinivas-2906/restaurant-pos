"use client";

import { useState } from "react";
import { KaanaBrand } from "./KaanaLogo";

export type StaffLoginAccent = "orange" | "amber" | "teal" | "slate";

const ACCENTS: Record<StaffLoginAccent, { button: string; ring: string; bg: string }> = {
  orange: {
    button: "bg-kaana hover:bg-kaana-dark",
    ring: "focus:ring-kaana/30 focus:border-kaana",
    bg: "from-orange-50 to-orange-100/80",
  },
  amber: {
    button: "bg-amber-600 hover:bg-amber-700",
    ring: "focus:ring-amber-500/30 focus:border-amber-500",
    bg: "from-amber-50 to-orange-50",
  },
  teal: {
    button: "bg-teal-600 hover:bg-teal-700",
    ring: "focus:ring-teal-500/30 focus:border-teal-500",
    bg: "from-teal-50 to-emerald-50",
  },
  slate: {
    button: "bg-sidebar hover:bg-gray-800",
    ring: "focus:ring-gray-400/30 focus:border-gray-500",
    bg: "from-slate-100 to-slate-50",
  },
};

export function StaffLoginForm({
  appName,
  badge,
  tagline,
  hint,
  defaultEmail = "",
  accent = "orange",
  onSubmit,
}: {
  appName: string;
  badge?: string;
  tagline: string;
  hint?: string;
  defaultEmail?: string;
  accent?: StaffLoginAccent;
  onSubmit: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const theme = ACCENTS[accent];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSubmit(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`min-h-dvh flex items-center justify-center bg-gradient-to-br ${theme.bg} p-4 sm:p-6 safe-bottom safe-top overflow-x-clip`}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 overflow-hidden">
        <div className="mb-6 min-w-0">
          <KaanaBrand size="lg" framed className="mb-4" />
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{appName}</h1>
            {badge && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded shrink-0">
                {badge}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{tagline}</p>
        </div>

        {hint && <p className="text-sm text-gray-600 mb-6 -mt-2">{hint}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="staff-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 ${theme.ring}`}
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="staff-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="staff-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 ${theme.ring}`}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 ${theme.button}`}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
