"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlatformNav } from "@/components/PlatformNav";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<{ totalOutlets: number; todayOrders: number; todayRevenue: number } | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/"); return; }
    api<{ totalOutlets: number; todayOrders: number; todayRevenue: number }>("/organizations/dashboard").then(setStats).catch(() => {});
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PlatformNav />
      <main className="p-6 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Platform Dashboard</h2>
        <p className="text-gray-500 mb-6">Kaana internal administration — tenant management, billing, and platform health.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <p className="text-sm text-gray-500">Active Outlets (demo org)</p>
            <p className="text-3xl font-bold mt-1">{stats?.totalOutlets ?? "—"}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <p className="text-sm text-gray-500">Orders today</p>
            <p className="text-3xl font-bold mt-1">{stats?.todayOrders ?? "—"}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <p className="text-sm text-gray-500">Revenue today</p>
            <p className="text-3xl font-bold mt-1">{stats ? `₹${Number(stats.todayRevenue).toLocaleString("en-IN")}` : "—"}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
