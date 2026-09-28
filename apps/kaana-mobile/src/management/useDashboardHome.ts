import { useCallback, useEffect, useState } from "react";
import { useManagement } from "./ManagementProvider";
import { endOfDayIso, startOfDayIso } from "./format";

export type DashboardHomeData = {
  todayOrders: number;
  todayRevenue: number;
  paymentSplit: Record<string, number>;
  openOrders: number;
  preparingOrders: number;
  readyOrders: number;
  lowStockCount: number;
  outOfStockCount: number;
};

export function useDashboardHome() {
  const { api, outletId, access } = useManagement();
  const [data, setData] = useState<DashboardHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    setError(null);
    try {
      const from = startOfDayIso();
      const to = endOfDayIso();
      const tasks: Promise<unknown>[] = [api.organizations.dashboard(outletId)];

      if (access.canViewReports && access.hasModule("pos")) {
        tasks.push(api.reports.sales(outletId, from, to));
        tasks.push(api.orders.getLive(outletId));
      }
      if (access.canManageInventory) {
        tasks.push(api.inventory.dashboard(outletId));
      }

      const results = await Promise.allSettled(tasks);
      const dash = results[0].status === "fulfilled" ? (results[0].value as Awaited<ReturnType<typeof api.organizations.dashboard>>) : null;
      let paymentSplit: Record<string, number> = {};
      let openOrders = 0;
      let preparingOrders = 0;
      let readyOrders = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      let idx = 1;
      if (access.canViewReports && access.hasModule("pos")) {
        const sales = results[idx];
        if (sales?.status === "fulfilled") {
          paymentSplit = (sales.value as { byPayment: Record<string, number> }).byPayment ?? {};
        }
        idx += 1;
        const live = results[idx];
        if (live?.status === "fulfilled") {
          const liveData = live.value as Awaited<ReturnType<typeof api.orders.getLive>>;
          for (const order of liveData.orders) {
            if (order.status === "open") openOrders += 1;
            else if (order.status === "preparing" || order.status === "kot_fired") preparingOrders += 1;
            else if (order.status === "ready") readyOrders += 1;
          }
        }
        idx += 1;
      }
      if (access.canManageInventory) {
        const inv = results[idx];
        if (inv?.status === "fulfilled") {
          const invData = inv.value as Awaited<ReturnType<typeof api.inventory.dashboard>>;
          lowStockCount = invData.lowStockCount ?? 0;
          outOfStockCount = invData.outOfStockCount ?? 0;
        }
      }

      setData({
        todayOrders: dash?.todayOrders ?? 0,
        todayRevenue: Number(dash?.todayRevenue ?? 0),
        paymentSplit,
        openOrders,
        preparingOrders,
        readyOrders,
        lowStockCount,
        outOfStockCount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [api, outletId, access]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refresh: load };
}
