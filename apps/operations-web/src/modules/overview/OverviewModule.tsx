"use client";

import Link from "next/link";
import { useMemo } from "react";
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
  UserCheck,
  UserX,
  Palmtree,
  LogIn,
} from "lucide-react";
import { TABLE_STATUS_COLORS, formatCurrency } from "@kaana/ui";
import { getOutletId } from "@/lib/api";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonCard, SkeletonPanel } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDashboardData } from "@/hooks/useDashboardData";
import { usePaginatedSlice } from "@/hooks/usePaginatedSlice";
import { PanelPagination } from "@/components/ui/PanelPagination";
import { computeHoursWorked } from "@/lib/attendanceSnapshot";
import {
  AttendanceSourceBadge,
  AttendanceStatusChip,
  ATTENDANCE_SOURCES,
  getAttendanceSource,
} from "@/lib/attendanceSource";

export function OverviewModule() {
  const outletId = getOutletId();
  const {
    loading,
    floorUnavailable,
    stats,
    ordersDelta,
    ordersDeltaPositive,
    revenueDelta,
    revenueDeltaPositive,
    lowStockCount,
    lowStockItems,
    pendingApprovals,
    tables,
    occupiedTables,
    orders,
    topItems,
    revenueSeries,
    orderStatusCounts,
    pendingPayrollCount,
    attendance,
  } = useDashboardData();

  const sourceEntries = Object.entries(attendance?.sourceBreakdown ?? {}).sort((a, b) => b[1] - a[1]);
  const onFloorStaff = useMemo(() => attendance?.onFloor ?? [], [attendance?.onFloor]);

  const recentOrders = usePaginatedSlice(orders, 5, outletId);
  const tableOverview = usePaginatedSlice(tables, 8, outletId);
  const topItemsPage = usePaginatedSlice(topItems, 5, outletId);
  const onFloorPage = usePaginatedSlice(onFloorStaff, 4, outletId);
  const inventoryPage = usePaginatedSlice(lowStockItems, 4, outletId);

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
            <MetricCard label="Today's Orders" value={stats?.todayOrders ?? "—"} delta={ordersDelta} deltaPositive={ordersDeltaPositive} icon={<ShoppingBag className="w-5 h-5" />} />
            <MetricCard
              label="Today's Revenue"
              value={stats ? formatCurrency(Number(stats.todayRevenue)) : "—"}
              delta={revenueDelta}
              deltaPositive={revenueDeltaPositive}
              icon={<IndianRupee className="w-5 h-5" />}
            />
            <MetricCard
              label="Active Tables"
              value={floorUnavailable ? "—" : `${occupiedTables} / ${tables.length}`}
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
            <Panel title="Revenue Overview" subtitle="Last 7 days" className="lg:col-span-1">
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

            <Panel title="Order Status" subtitle="Today">
              <div className="h-56 flex items-center justify-center">
                {orderStatusCounts.length === 0 ? (
                  <EmptyState title="No order data" description="No orders recorded today." />
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

            <Panel title="Top Selling Items" subtitle="Last 7 days">
              {topItems.length === 0 ? (
                <EmptyState title="No sales data" description="Top items will appear once orders are recorded." />
              ) : (
                <>
                  <ul className="space-y-3">
                    {topItemsPage.items.map((item, i) => (
                      <li key={item.name} className="flex items-center justify-between text-sm gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 shrink-0 rounded-full bg-gray-100 text-xs font-semibold flex items-center justify-center text-gray-600">
                            {topItemsPage.page * topItemsPage.pageSize + i + 1}
                          </span>
                          <span className="font-medium text-gray-900 truncate">{item.name}</span>
                        </span>
                        <span className="text-gray-600 shrink-0">{formatCurrency(item.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                  {topItemsPage.showPagination && (
                    <PanelPagination
                      page={topItemsPage.page}
                      totalPages={topItemsPage.totalPages}
                      totalItems={topItemsPage.totalItems}
                      pageSize={topItemsPage.pageSize}
                      hasPrev={topItemsPage.hasPrev}
                      hasNext={topItemsPage.hasNext}
                      onPrev={topItemsPage.goPrev}
                      onNext={topItemsPage.goNext}
                    />
                  )}
                </>
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
          {orders.length === 0 ? (
            <EmptyState title="No recent orders" />
          ) : (
            <>
              <ul className="divide-y divide-gray-100 -mx-1">
                {recentOrders.items.map((o) => (
                  <li key={o.id} className="py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">#{o.orderNumber ?? o.id.slice(-6)}</p>
                      <p className="text-xs text-gray-500 capitalize truncate">{o.type?.replace(/_/g, " ") ?? "dine in"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{o.totalAmount != null ? formatCurrency(Number(o.totalAmount)) : "—"}</p>
                      <StatusBadge status={o.status} />
                    </div>
                  </li>
                ))}
              </ul>
              {recentOrders.showPagination && (
                <PanelPagination
                  page={recentOrders.page}
                  totalPages={recentOrders.totalPages}
                  totalItems={recentOrders.totalItems}
                  pageSize={recentOrders.pageSize}
                  hasPrev={recentOrders.hasPrev}
                  hasNext={recentOrders.hasNext}
                  onPrev={recentOrders.goPrev}
                  onNext={recentOrders.goNext}
                />
              )}
            </>
          )}
        </Panel>

        <Panel
          title="Table Overview"
          action={<Link href="/orders" className="text-sm text-kaana font-medium hover:underline">Floor plan</Link>}
        >
          {floorUnavailable ? (
            <EmptyState title="Floor unavailable" description="Could not load table status for this outlet." />
          ) : tables.length === 0 ? (
            <EmptyState title="No tables configured" />
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {tableOverview.items.map((t, i) => {
                  const phase = t.displayPhase ?? "free";
                  const cls = TABLE_STATUS_COLORS[phase] ?? TABLE_STATUS_COLORS.free;
                  const globalIndex = tableOverview.page * tableOverview.pageSize + i;
                  return (
                    <div key={t.id ?? globalIndex} className={`p-2.5 rounded-lg border-2 text-center text-sm min-w-0 overflow-hidden ${cls}`}>
                      <p className="font-bold truncate">{t.number ?? `T${globalIndex + 1}`}</p>
                      <p className="text-xs capitalize mt-0.5 truncate leading-tight">{t.displayLabel ?? phase.replace(/_/g, " ")}</p>
                    </div>
                  );
                })}
              </div>
              {tableOverview.showPagination && (
                <PanelPagination
                  page={tableOverview.page}
                  totalPages={tableOverview.totalPages}
                  totalItems={tableOverview.totalItems}
                  pageSize={tableOverview.pageSize}
                  hasPrev={tableOverview.hasPrev}
                  hasNext={tableOverview.hasNext}
                  onPrev={tableOverview.goPrev}
                  onNext={tableOverview.goNext}
                />
              )}
            </>
          )}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Panel
          title="Today's Attendance"
          subtitle="Live punch-in tracking by channel"
          action={<Link href="/staff/attendance" className="text-sm text-kaana font-medium hover:underline">Full attendance</Link>}
          className="lg:col-span-2"
        >
          {loading ? (
            <div className="h-40 animate-pulse bg-gray-100 rounded-xl" />
          ) : !attendance ? (
            <EmptyState title="Attendance unavailable" description="Could not load today's punch data for this outlet." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <AttendanceStatusChip
                  label="On floor now"
                  count={attendance.totals.onFloor ?? 0}
                  tone="green"
                  icon={<LogIn className="w-4 h-4" />}
                />
                <AttendanceStatusChip
                  label="Checked in today"
                  count={attendance.totals.checkedIn}
                  tone="amber"
                  icon={<UserCheck className="w-4 h-4" />}
                />
                <AttendanceStatusChip
                  label="Not in yet"
                  count={attendance.totals.notInYet}
                  tone="gray"
                  icon={<UserX className="w-4 h-4" />}
                />
                <AttendanceStatusChip
                  label="On leave"
                  count={attendance.totals.onLeave}
                  tone="purple"
                  icon={<Palmtree className="w-4 h-4" />}
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Currently on floor</p>
                {(attendance.onFloor ?? []).length === 0 ? (
                  <p className="text-sm text-gray-500">No one is clocked in right now.</p>
                ) : (
                  <>
                    <ul className="divide-y divide-gray-100 -mx-1">
                      {onFloorPage.items.map((person) => (
                        <li key={person.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-gray-900 truncate">{person.name}</p>
                            <p className="text-xs text-gray-500 truncate">
                              {person.role ?? "Staff"} · In {new Date(person.clockIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {computeHoursWorked(person.clockIn, undefined, person.hoursWorked).toFixed(1)}h
                            </p>
                          </div>
                          <AttendanceSourceBadge source={person.source} />
                        </li>
                      ))}
                    </ul>
                    {onFloorPage.showPagination && (
                      <PanelPagination
                        page={onFloorPage.page}
                        totalPages={onFloorPage.totalPages}
                        totalItems={onFloorPage.totalItems}
                        pageSize={onFloorPage.pageSize}
                        hasPrev={onFloorPage.hasPrev}
                        hasNext={onFloorPage.hasNext}
                        onPrev={onFloorPage.goPrev}
                        onNext={onFloorPage.goNext}
                      />
                    )}
                  </>
                )}
              </div>

              {sourceEntries.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Punch channels today</p>
                  <div className="flex flex-wrap gap-2">
                    {sourceEntries.map(([source, count]) => {
                      const meta = getAttendanceSource(source);
                      const Icon = meta.Icon;
                      return (
                        <span
                          key={source}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${meta.badgeClass}`}
                          title={meta.description}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {meta.label}
                          <span className="opacity-70">({count})</span>
                        </span>
                      );
                    })}
                    {!sourceEntries.some(([s]) => s === "biometric") && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-200 px-2.5 py-1.5 text-xs text-gray-400" title={ATTENDANCE_SOURCES.biometric.description}>
                        <ATTENDANCE_SOURCES.biometric.Icon className="w-3.5 h-3.5" />
                        Biometric — not connected
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel
          title="Payroll pending"
          action={<Link href="/payroll" className="text-sm text-kaana font-medium hover:underline">Review</Link>}
        >
          <p className="text-3xl font-bold text-gray-900">{pendingPayrollCount}</p>
          <p className="text-sm text-gray-500 mt-1">Draft runs awaiting approval</p>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Panel
          title="Inventory Alerts"
          action={<Link href="/inventory" className="text-sm text-kaana font-medium hover:underline">Manage</Link>}
        >
          {lowStockItems.length === 0 ? (
            <EmptyState title="All stocked" description="No ingredients below minimum levels." />
          ) : (
            <>
              <ul className="space-y-4">
                {inventoryPage.items.map((item) => {
                  const pct = item.minStock > 0 ? Math.min(100, (item.currentStock / item.minStock) * 100) : 0;
                  return (
                    <li key={item.id}>
                      <div className="flex justify-between text-sm mb-1 gap-2">
                        <span className="font-medium truncate">{item.name}</span>
                        <span className="text-red-600 shrink-0">{item.currentStock} / {item.minStock} {item.unit}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              {inventoryPage.showPagination && (
                <PanelPagination
                  page={inventoryPage.page}
                  totalPages={inventoryPage.totalPages}
                  totalItems={inventoryPage.totalItems}
                  pageSize={inventoryPage.pageSize}
                  hasPrev={inventoryPage.hasPrev}
                  hasNext={inventoryPage.hasNext}
                  onPrev={inventoryPage.goPrev}
                  onNext={inventoryPage.goNext}
                />
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
