"use client";

import { useEffect, useState } from "react";
import { api, getOutletId, daysAgoRange, formatCountDelta, formatRevenueDelta } from "@/lib/api";
import { deriveTableDisplayPhase, isTableActive, tableDisplayLabel, type TableDisplayPhase } from "@/lib/tablePhase";
import { normalizeAttendanceSnapshot, type AttendanceSnapshot } from "@/lib/attendanceSnapshot";

export interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  yesterdayOrders?: number;
  yesterdayRevenue?: number;
  ordersDelta?: number;
  revenueDelta?: number;
  totalOutlets?: number;
}

export interface FloorTable {
  id?: string;
  number?: string;
  status?: string;
  displayPhase?: TableDisplayPhase;
  displayLabel?: string;
  activeOrder?: {
    status: string;
    totalAmount?: number | string;
    itemQty?: number;
    pendingKot?: number;
    inKitchen?: number;
    readyCount?: number;
    servedCount?: number;
    allReady?: boolean;
  } | null;
}

export interface HubOrder {
  id: string;
  orderNumber?: number | string;
  status: string;
  type?: string;
  tableId?: string;
  totalAmount?: number;
  createdAt?: string;
  settledAt?: string;
}

export interface IngredientAlert {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
}

export interface TopItem {
  name: string;
  quantity: number;
  revenue: number;
}

export interface RevenueDay {
  date: string;
  label: string;
  revenue: number;
}

export type { AttendanceSnapshot } from "@/lib/attendanceSnapshot";

export interface DashboardData {
  loading: boolean;
  floorUnavailable: boolean;
  stats: DashboardStats | null;
  ordersDelta: string | null;
  ordersDeltaPositive: boolean | undefined;
  revenueDelta: string | null;
  revenueDeltaPositive: boolean | undefined;
  lowStockCount: number;
  lowStockItems: IngredientAlert[];
  pendingApprovals: number;
  tables: FloorTable[];
  occupiedTables: number;
  orders: HubOrder[];
  topItems: TopItem[];
  revenueSeries: RevenueDay[];
  orderStatusCounts: { name: string; value: number; color: string }[];
  onFloorCount: number;
  pendingPayrollCount: number;
  attendance: AttendanceSnapshot | null;
}

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  kot_fired: "#f59e0b",
  preparing: "#f59e0b",
  billed: "#8b5cf6",
  settled: "#22c55e",
  cancelled: "#ef4444",
};

function dayLabel(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}

function isOrderToday(order: { status: string; createdAt?: string; settledAt?: string }) {
  const now = new Date();
  const check = (iso?: string) => {
    if (!iso) return false;
    const d = new Date(iso);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };
  if (order.status === "settled") return check(order.settledAt ?? order.createdAt);
  return check(order.createdAt);
}

export function useDashboardData(): DashboardData {
  const outletId = getOutletId();
  const [loading, setLoading] = useState(true);
  const [floorUnavailable, setFloorUnavailable] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [ordersDelta, setOrdersDelta] = useState<string | null>(null);
  const [ordersDeltaPositive, setOrdersDeltaPositive] = useState<boolean | undefined>(undefined);
  const [revenueDelta, setRevenueDelta] = useState<string | null>(null);
  const [revenueDeltaPositive, setRevenueDeltaPositive] = useState<boolean | undefined>(undefined);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<IngredientAlert[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [orders, setOrders] = useState<HubOrder[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [revenueSeries, setRevenueSeries] = useState<RevenueDay[]>([]);
  const [orderStatusCounts, setOrderStatusCounts] = useState<{ name: string; value: number; color: string }[]>([]);
  const [onFloorCount, setOnFloorCount] = useState(0);
  const [pendingPayrollCount, setPendingPayrollCount] = useState(0);
  const [attendance, setAttendance] = useState<AttendanceSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const weekRange = daysAgoRange(6);
      const dashboardPath = outletId
        ? `/organizations/dashboard?outletId=${outletId}`
        : "/organizations/dashboard";

      const results = await Promise.allSettled([
        api<DashboardStats>(dashboardPath),
        outletId
          ? api<Array<{ id: string; name: string; unit: string; currentStock: number; reorderLevel: number; isLowStock: boolean }>>(
              `/reports/inventory?outletId=${outletId}`,
            )
          : Promise.resolve([]),
        outletId ? api<{ total: number }>(`/approvals/pending?outletId=${outletId}`) : Promise.resolve({ total: 0 }),
        outletId
          ? api<{ tables?: FloorTable[] } | null>(`/outlets/${outletId}/floor`)
          : Promise.resolve(null),
        outletId
          ? api<HubOrder[]>(`/orders?outletId=${outletId}`)
          : Promise.resolve([]),
        outletId
          ? api<TopItem[]>(`/reports/items?outletId=${outletId}&from=${weekRange.from}&to=${weekRange.to}`)
          : Promise.resolve([]),
        outletId
          ? api<Array<{ date: string; revenue: number }>>(
              `/reports/sales/daily?outletId=${outletId}&from=${weekRange.from}&to=${weekRange.to}`,
            )
          : Promise.resolve([]),
        outletId ? api<AttendanceSnapshot>(`/staff/outlets/${outletId}/attendance`) : Promise.resolve(null),
        api<Array<{ status: string }>>("/payroll/runs").catch(() => []),
      ]);

      if (cancelled) return;

      const [statsR, inventoryR, approvalsR, floorR, cloudOrdersR, itemsR, revenueR, attendanceR, payrollR] = results;

      if (statsR.status === "fulfilled") {
        const s = statsR.value;
        setStats(s);
        const orderD = formatCountDelta(s.todayOrders, s.yesterdayOrders ?? 0);
        const revD = formatRevenueDelta(Number(s.todayRevenue), Number(s.yesterdayRevenue ?? 0));
        setOrdersDelta(orderD.text);
        setOrdersDeltaPositive(orderD.positive);
        setRevenueDelta(revD.text);
        setRevenueDeltaPositive(revD.positive);
      }

      if (approvalsR.status === "fulfilled") setPendingApprovals(approvalsR.value.total);

      if (inventoryR.status === "fulfilled") {
        const low = inventoryR.value
          .filter((i) => i.isLowStock)
          .map((i) => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
            currentStock: Number(i.currentStock),
            minStock: Number(i.reorderLevel),
          }));
        setLowStockCount(low.length);
        setLowStockItems(low.slice(0, 20));
      }

      if (floorR.status === "fulfilled" && floorR.value?.tables) {
        setFloorUnavailable(false);
        setTables(
          floorR.value.tables.map((t) => {
            const phase = deriveTableDisplayPhase(t);
            return {
              ...t,
              displayPhase: phase,
              displayLabel: tableDisplayLabel(phase),
            };
          }),
        );
      } else {
        setFloorUnavailable(true);
        setTables([]);
      }

      if (cloudOrdersR.status === "fulfilled") {
        const all = (cloudOrdersR.value ?? []).map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          type: o.type,
          tableId: o.tableId,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
          settledAt: (o as HubOrder).settledAt,
        }));
        const todayOrders = all.filter(isOrderToday);
        setOrders(all.slice(0, 20));

        const counts: Record<string, number> = {};
        for (const o of todayOrders) counts[o.status] = (counts[o.status] ?? 0) + 1;
        setOrderStatusCounts(
          Object.entries(counts).map(([name, value]) => ({
            name: name.replace(/_/g, " "),
            value,
            color: STATUS_COLORS[name] ?? "#94a3b8",
          })),
        );
      } else {
        setOrders([]);
        setOrderStatusCounts([]);
      }

      if (itemsR.status === "fulfilled") setTopItems((itemsR.value ?? []).slice(0, 15));

      if (attendanceR.status === "fulfilled" && attendanceR.value) {
        const a = normalizeAttendanceSnapshot(attendanceR.value);
        setAttendance(a);
        setOnFloorCount(a.totals.onFloor);
      } else {
        setAttendance(null);
        setOnFloorCount(0);
      }
      if (payrollR.status === "fulfilled") {
        setPendingPayrollCount((payrollR.value as Array<{ status: string }>).filter((r) => r.status === "draft").length);
      }

      if (revenueR.status === "fulfilled") {
        const days = (revenueR.value ?? []).map((d) => ({
          date: d.date,
          label: dayLabel(new Date(d.date)),
          revenue: Number(d.revenue),
        }));
        setRevenueSeries(days);
      } else {
        setRevenueSeries([]);
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [outletId]);

  const occupiedTables = tables.filter(isTableActive).length;

  return {
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
    onFloorCount,
    pendingPayrollCount,
    attendance,
  };
}
