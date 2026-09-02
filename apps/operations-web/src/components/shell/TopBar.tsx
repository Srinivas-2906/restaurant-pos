"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Calendar, Menu, Plus, Search } from "lucide-react";
import { POS_WEB_URL } from "@kaana/role-shells";
import { getUser, getOutletId, api } from "@/lib/api";
import { OutletSelector } from "@/components/OutletSelector";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

interface TopBarProps {
  onMenuClick?: () => void;
  hubOffline?: boolean;
}

export function TopBar({ onMenuClick, hubOffline }: TopBarProps) {
  const [mounted, setMounted] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [greeting, setGreeting] = useState("Hello");
  const [outletId, setOutletId] = useState<string | null>(null);
  const [approvals, setApprovals] = useState(0);

  useEffect(() => {
    const user = getUser();
    setFirstName(user?.firstName ?? null);
    setOutletId(getOutletId());
    setGreeting(getGreeting());
    setToday(new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !outletId) return;
    api<{ total: number }>(`/approvals/pending?outletId=${outletId}`)
      .then((p) => setApprovals(p.total))
      .catch(() => {});
  }, [mounted, outletId]);

  const posUrl = outletId ? `${POS_WEB_URL}?outletId=${outletId}` : POS_WEB_URL;

  return (
    <header className="sticky top-0 z-30 bg-surface-card border-b border-gray-200/80">
      {hubOffline && (
        <div className="bg-amber-50 text-amber-800 text-xs text-center py-1.5 px-4 border-b border-amber-100">
          Local hub offline — showing cloud data only
        </div>
      )}
      <div className="px-4 lg:px-8 py-4 flex flex-wrap items-center gap-4">
        <button type="button" onClick={onMenuClick} className="lg:hidden p-2 min-h-11 min-w-11 rounded-lg hover:bg-gray-100" aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-[200px]">
          <p className="text-lg font-semibold text-gray-900" suppressHydrationWarning>
            {greeting}, {mounted ? firstName ?? "there" : "there"}!
          </p>
          <p className="text-sm text-gray-500 hidden sm:block">Here&apos;s what&apos;s happening in your restaurant today.</p>
        </div>

        <div className="relative hidden md:block flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search orders, customers, menu..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-kaana/30 focus:border-kaana"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <OutletSelector />
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span suppressHydrationWarning>{mounted ? today : "…"}</span>
          </div>
          <Link href="/overview#approvals" className="relative p-2 rounded-xl hover:bg-gray-100">
            <Bell className="w-5 h-5 text-gray-600" />
            {approvals > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {approvals > 9 ? "9+" : approvals}
              </span>
            )}
          </Link>
          <a
            href={posUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-kaana hover:bg-kaana-dark text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Order</span>
          </a>
        </div>
      </div>
    </header>
  );
}
