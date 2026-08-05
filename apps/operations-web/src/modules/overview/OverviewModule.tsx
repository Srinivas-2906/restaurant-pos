"use client";

import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ShoppingBag,
  IndianRupee,
  LayoutGrid,
  Package,
  ClipboardCheck,
} from "lucide-react";
import { TABLE_STATUS_COLORS, formatCurrency } from "@kaana/ui";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonCard, SkeletonPanel } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDashboardData } from "@/hooks/useDashboardData";

export function OverviewModule() {
  const {
    loading,
    hubOffline,
    stats,
    lowStockCount,
    lowStockItems,
    pendingApprovals,
    tables,
    occupiedTables,
    orders,
    topItems,
    revenueSeries,
    orderStatusCounts,
    onFloorCount,
    pendingPayrollCount,
  } = useDashboardData();

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {pendingApprovals > 0 && (
        <section id="approvals" className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-amber-900">Approvals need attention</p>
            <p className="text-sm text-amber-700">{pendingApprovals} items waiting for manager review.</p>
          </div>
          <Link href="/inventory" className="text-sm font-medium text-kaana hover:underline">Review</Link>
        </section>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard label="Total Orders" value={stats?.todayOrders ?? "—"} delta={null} icon={<ShoppingBag className="w-5 h-5" />} />
            <MetricCard
              label="Total Revenue"
              value={stats ? formatCurrency(Number(stats.todayRevenue)) : "—"}
              delta={null}
              icon={<IndianRupee className="w-5 h-5" />}
            />
            <MetricCard
              label="Active Tables"
              value={hubOffline ? "—" : `${occupiedTables} / ${tables.length}`}
              delta={null}
              icon={<LayoutGrid className="w-5 h-5" />}
            />
            <Link href="/inventory">
              <MetricCard label="Low Stock" value={lowStockCount} delta={null} icon={<Package className="w-5 h-5" />} />
            </Link>
            <MetricCard label="Pending Approvals" value={pendingApprovals} delta={null} icon={<ClipboardCheck className="w-5 h-5" />} />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {loading ? (
          <>
            <SkeletonPanel />
            <SkeletonPanel />
            <SkeletonPanel />
          </>
        ) : (
          <>
            <Panel title="Revenue Overview" className="lg:col-span-1">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `₹${v / 1000}k`} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                    <Line type="monotone" dataKey="revenue" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Order Status">
              <div className="h-56 flex items-center justify-center">
                {orderStatusCounts.length === 0 ? (
                  <EmptyState title="No order data" description={hubOffline ? "Hub offline — order status unavailable." : "No orders yet today."} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={orderStatusCounts} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {orderStatusCounts.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              {orderStatusCounts.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-2 justify-center">
                  {orderStatusCounts.map((s) => (
                    <span key={s.name} className="text-xs text-gray-600 flex items-center gap-1 capitalize">
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      {s.name} ({s.value})
                    </span>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Top Selling Items">
              {topItems.length === 0 ? (
                <EmptyState title="No sales data" description="Top items will appear once orders are recorded." />
              ) : (
                <ul className="space-y-3">
                  {topItems.map((item, i) => (
                    <li key={item.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gray-100 text-xs font-semibold flex items-center justify-center text-gray-600">{i + 1}</span>
                        <span className="font-medium text-gray-900">{item.name}</span>
                      </span>
                      <span className="text-gray-600">{formatCurrency(item.revenue)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Panel
          title="Recent Orders"
          action={<Link href="/orders" className="text-sm text-kaana font-medium hover:underline">View all</Link>}
        >
          {hubOffline ? (
            <EmptyState title="Hub offline" description="Recent orders require the local outlet hub." />
          ) : orders.length === 0 ? (
            <EmptyState title="No recent orders" />
          ) : (
            <ul className="divide-y divide-gray-100 -mx-1">
              {orders.map((o) => (
                <li key={o.id} className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">#{o.orderNumber ?? o.id.slice(-6)}</p>
                    <p className="text-xs text-gray-500 capitalize">{o.type?.replace(/_/g, " ") ?? "dine in"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{o.totalAmount != null ? formatCurrency(Number(o.totalAmount)) : "—"}</p>
                    <StatusBadge status={o.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Table Overview"
          action={<Link href="/orders" className="text-sm text-kaana font-medium hover:underline">Floor plan</Link>}
        >
          {hubOffline ? (
            <EmptyState title="Hub offline" description="Table status requires the local outlet hub." />
          ) : tables.length === 0 ? (
            <EmptyState title="No tables configured" />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {tables.map((t, i) => {
                const status = t.status ?? "free";
                const cls = TABLE_STATUS_COLORS[status] ?? TABLE_STATUS_COLORS.free;
                return (
                  <div key={t.id ?? i} className={`p-3 rounded-lg border-2 text-center text-sm ${cls}`}>
                    <p className="font-bold">{t.number ?? `T${i + 1}`}</p>
                    <p className="text-xs capitalize mt-0.5">{status}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Staff on floor"
          action={<Link href="/staff/attendance" className="text-sm text-kaana font-medium hover:underline">Attendance</Link>}
        >
          <p className="text-3xl font-bold text-gray-900">{onFloorCount}</p>
          <p className="text-sm text-gray-500 mt-1">Currently clocked in</p>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Panel
          title="Payroll pending"
          action={<Link href="/finance/payroll" className="text-sm text-kaana font-medium hover:underline">Review</Link>}
        >
          <p className="text-3xl font-bold text-gray-900">{pendingPayrollCount}</p>
          <p className="text-sm text-gray-500 mt-1">Draft runs awaiting approval</p>
        </Panel>

        <Panel
          title="Inventory Alerts"
          action={<Link href="/inventory" className="text-sm text-kaana font-medium hover:underline">Manage</Link>}
        >
          {lowStockItems.length === 0 ? (
            <EmptyState title="All stocked" description="No ingredients below minimum levels." />
          ) : (
            <ul className="space-y-4">
              {lowStockItems.map((item) => {
                const pct = item.minStock > 0 ? Math.min(100, (item.currentStock / item.minStock) * 100) : 0;
                return (
                  <li key={item.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-red-600">{item.currentStock} / {item.minStock} {item.unit}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
