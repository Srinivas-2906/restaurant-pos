"use client";

import { useCallback, useEffect, useState } from "react";
import { notify } from "@kaana/ui";
import type { OrderDto } from "@kaana/shared-types";
import { CaptainMenuGrid } from "./CaptainMenuGrid";
import { CaptainCart } from "./CaptainCart";
import { CaptainKotBar } from "./CaptainKotBar";
import { CaptainBillActions } from "./CaptainBillActions";
import {
  addOrderItem,
  createTableOrder,
  fetchMenu,
  fetchOutletSettings,
  fireKot,
  getOpenOrderByTable,
  removeOrderItem,
  requestBill,
  resolveOutletId,
  settleOrder,
  updateItemQty,
  type MenuCategory,
} from "@/lib/api";

export function CaptainTableOrder({
  tableId,
  tableNumber,
  guestCount,
}: {
  tableId: string;
  tableNumber: string;
  guestCount: number;
}) {
  const [outletId, setOutletId] = useState("");
  const [menu, setMenu] = useState<MenuCategory[]>([]);
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const oid = await resolveOutletId();
    if (!oid) return;
    setOutletId(oid);
    const [menuData, outletData, openOrder] = await Promise.all([
      fetchMenu(oid),
      fetchOutletSettings(oid),
      getOpenOrderByTable(oid, tableId),
    ]);
    setMenu(menuData);
    setSettings(outletData.settings ?? {});
    if (openOrder) {
      setOrder(openOrder);
    } else {
      const created = await createTableOrder(oid, tableId, guestCount);
      setOrder(created);
      notify.success(`Order opened for Table ${tableNumber}`);
    }
  }, [tableId, tableNumber, guestCount]);

  useEffect(() => {
    load()
      .catch((e) => notify.error(e instanceof Error ? e.message : "Failed to load order"))
      .finally(() => setLoading(false));
  }, [load]);

  async function run<T>(fn: () => Promise<T>) {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Action failed");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  if (loading || !order) {
    return <p className="text-slate-500 text-center py-12">Loading order…</p>;
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div>
        <CaptainMenuGrid
          menu={menu}
          disabled={busy}
          onAdd={(itemId) =>
            run(async () => {
              const updated = await addOrderItem(order.id, itemId);
              setOrder(updated);
            })
          }
        />
      </div>
      <div className="space-y-4 p-4 rounded-2xl border border-slate-200 bg-slate-50">
        <div>
          <h2 className="font-semibold text-slate-900">Table {tableNumber}</h2>
          <p className="text-xs text-slate-500">{order.orderNumber}</p>
        </div>
        <CaptainCart
          order={order}
          disabled={busy}
          onQtyChange={(itemId, qty) =>
            run(async () => {
              const updated = qty < 1
                ? await removeOrderItem(order.id, itemId)
                : await updateItemQty(order.id, itemId, qty);
              setOrder(updated);
            })
          }
          onRemove={(itemId) =>
            run(async () => {
              const updated = await removeOrderItem(order.id, itemId);
              setOrder(updated);
            })
          }
        />
        <CaptainKotBar
          order={order}
          firing={busy}
          onFire={() =>
            run(async () => {
              const kots = await fireKot(order.id);
              const refreshed = await getOpenOrderByTable(outletId, tableId);
              if (refreshed) setOrder(refreshed);
              notify.success(`Sent to kitchen · ${kots.map((k) => k.kotNumber).join(", ")}`);
            })
          }
        />
        <CaptainBillActions
          order={order}
          outletSettings={settings}
          busy={busy}
          onRequestBill={() =>
            run(async () => {
              const updated = await requestBill(order.id);
              setOrder(updated);
              notify.success("Bill requested — cashier notified");
            })
          }
          onSettle={() =>
            run(async () => {
              await settleOrder(order.id, [{ method: "upi", amount: Number(order.totalAmount) }]);
              notify.success("Bill settled");
              await load();
            })
          }
        />
      </div>
    </div>
  );
}
