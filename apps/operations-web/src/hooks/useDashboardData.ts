"use client";

import { useEffect, useState } from "react";
import { api, hub, getOutletId } from "@/lib/api";

export interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  totalOutlets?: number;
}

export interface FloorTable {
  id?: string;
  number?: string;
  status?: string;
}

export interface HubOrder {
  id: string;
  orderNumber?: number | string;
  status: string;
  type?: string;
  tableId?: string;
  totalAmount?: number;
  createdAt?: string;
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

export interface DashboardData {
  loading: boolean;
  hubOffline: boolean;
  stats: DashboardStats | null;
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
}

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  kot_fired: "#f59e0b",
  settled: "#22c55e",
  cancelled: "#ef4444",
};

function dayLabel(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function useDashboardData(): DashboardData {
  const outletId = getOutletId();
  const [loading, setLoading] = useState(true);
  const [hubOffline, setHubOffline] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 6);
      const from = weekAgo.toISOString();
      const to = now.toISOString();

      const dayPromises = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekAgo);
        d.setDate(weekAgo.getDate() + i);
        const dayFrom = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const dayTo = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
        return outletId
          ? api<{ totalRevenue?: number }>(`/reports/sales?outletId=${outletId}&from=${dayFrom}&to=${dayTo}`).then((r) => ({
              date: isoDay(d),
              label: dayLabel(d),
              revenue: Number(r.totalRevenue ?? 0),
            }))
          : Promise.resolve({ date: isoDay(d), label: dayLabel(d), revenue: 0 });
      });

      const results = await Promise.allSettled([
        api<DashboardStats>("/organizations/dashboard"),
        outletId
          ? api<Array<{ id: string; name: string; unit: string; currentStock: number | string; minStock: number | string }>>(
              `/inventory/outlets/${outletId}/ingredients`,
            )
          : Promise.resolve([]),
        outletId ? api<{ total: number }>(`/approvals/pending?outletId=${outletId}`) : Promise.resolve({ total: 0 }),
        hub<{ tables?: FloorTable[] }>("/hub/floor"),
        hub<HubOrder[]>("/hub/orders"),
        outletId
          ? api<TopItem[]>(`/reports/items?outletId=${outletId}&from=${from}&to=${to}`)
          : Promise.resolve([]),
        outletId ? api<unknown[]>(`/staff/outlets/${outletId}/on-floor`) : Promise.resolve([]),
        api<Array<{ status: string }>>("/payroll/runs").catch(() => []),
        Promise.allSettled(dayPromises),
      ]);

      if (cancelled) return;

      const [statsR, ingredientsR, approvalsR, floorR, ordersR, itemsR, onFloorR, payrollR, revenueR] = results;

      if (statsR.status === "fulfilled") setStats(statsR.value);
      if (approvalsR.status === "fulfilled") setPendingApprovals(approvalsR.value.total);

      if (ingredientsR.status === "fulfilled") {
        const low = ingredientsR.value
          .filter((i) => Number(i.currentStock) <= Number(i.minStock))
          .map((i) => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
            currentStock: Number(i.currentStock),
            minStock: Number(i.minStock),
          }));
        setLowStockCount(low.length);
        setLowStockItems(low.slice(0, 5));
      }

      if (floorR.status === "fulfilled") {
        setHubOffline(false);
        setTables(floorR.value.tables ?? []);
      } else {
        setHubOffline(true);
        setTables([]);
      }

      if (ordersR.status === "fulfilled") {
        const all = ordersR.value ?? [];
        setOrders(all.slice(0, 8));
        const counts: Record<string, number> = {};
        for (const o of all) counts[o.status] = (counts[o.status] ?? 0) + 1;
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

      if (itemsR.status === "fulfilled") setTopItems((itemsR.value ?? []).slice(0, 5));

      if (onFloorR.status === "fulfilled") setOnFloorCount((onFloorR.value as unknown[])?.length ?? 0);
      if (payrollR.status === "fulfilled") {
        setPendingPayrollCount((payrollR.value as Array<{ status: string }>).filter((r) => r.status === "draft").length);
      }

      if (revenueR.status === "fulfilled") {
        const days = revenueR.value.map((r) => (r.status === "fulfilled" ? r.value : null)).filter(Boolean) as RevenueDay[];
        setRevenueSeries(days.length ? days : buildEmptySeries(weekAgo));
      } else {
        setRevenueSeries(buildEmptySeries(weekAgo));
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [outletId]);

  const occupiedTables = tables.filter((t) => t.status && t.status !== "free").length;

  return {
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
  };
}

function buildEmptySeries(start: Date): RevenueDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return { date: isoDay(d), label: dayLabel(d), revenue: 0 };
  });
}
