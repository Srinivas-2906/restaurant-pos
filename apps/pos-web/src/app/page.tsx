"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { api, login, TABLE_COLORS } from "@/lib/api";
import { OfflineSyncQueue, replaySyncQueue } from "@kaana/sync-engine";

interface Table { id: string; number: string; status: string; capacity: number }
interface MenuItem { id: string; name: string; price: number; isAvailable: boolean; isVeg: boolean }
interface Category { id: string; name: string; items: MenuItem[] }
interface Order { id: string; orderNumber: string; items: Array<{ id: string; name: string; quantity: number; totalPrice: number }>; totalAmount: number; status: string }

function POSApp() {
  const searchParams = useSearchParams();
  const outletId = searchParams.get("outletId") || "";
  const [authenticated, setAuthenticated] = useState(false);
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<Category[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [online, setOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [clockRecordId, setClockRecordId] = useState<string | null>(null);
  const [clockMsg, setClockMsg] = useState("");
  const clientId = typeof window !== "undefined" ? localStorage.getItem("clientId") || crypto.randomUUID() : "";

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("clientId")) {
      localStorage.setItem("clientId", clientId);
    }
    setOnline(navigator.onLine);
    window.addEventListener("online", () => setOnline(true));
    window.addEventListener("offline", () => setOnline(false));
  }, [clientId]);

  const loadData = useCallback(async () => {
    if (!outletId) return;
    const floor = await api<{ tables: Table[] }>(`/outlets/${outletId}/floor`);
    setTables(floor?.tables ?? []);
    const menuData = await api<Array<{ categories: Category[] }>>(`/outlets/${outletId}/menu`);
    const cats = menuData[0]?.categories ?? [];
    setMenu(cats);
    if (cats[0]) setActiveCategory(cats[0].id);
  }, [outletId]);

  useEffect(() => {
    if (!authenticated || !outletId) return;
    loadData().catch(console.error);
  }, [authenticated, outletId, loadData]);

  async function handleLogin() {
    const data = await login("biller@kaanafoods.in", "password123") as {
      user?: { id: string; roles?: Array<{ role: string }> };
    };
    const role = data.user?.roles?.[0]?.role ?? "biller";
    if (role !== "biller") {
      const { redirectUrlForRole } = await import("@kaana/role-shells");
      window.location.href = redirectUrlForRole(role as never);
      return;
    }
    if (data.user?.id) localStorage.setItem("userId", data.user.id);
    setAuthenticated(true);
  }

  async function clockIn() {
    const userId = localStorage.getItem("userId");
    if (!userId || !outletId) return;
    try {
      const rec = await api<{ id: string }>("/staff/clock-in", {
        method: "POST",
        body: JSON.stringify({ outletId, userId, source: "pos" }),
      });
      setClockRecordId(rec.id);
      setClockMsg("Clocked in");
    } catch {
      setClockMsg("Clock-in failed");
    }
  }

  async function clockOut() {
    if (!clockRecordId) return;
    try {
      await api(`/staff/clock-out/${clockRecordId}`, { method: "POST" });
      setClockRecordId(null);
      setClockMsg("Clocked out");
    } catch {
      setClockMsg("Clock-out failed");
    }
  }

  async function openTable(table: Table) {
    setSelectedTable(table);
    const order = await api<Order>("/orders", {
      method: "POST",
      body: JSON.stringify({ outletId, tableId: table.id, type: "dine_in" }),
    });
    setCurrentOrder(order);
  }

  async function addItem(item: MenuItem) {
    if (!currentOrder) return;
    const updated = await api<Order>(`/orders/${currentOrder.id}/items`, {
      method: "POST",
      body: JSON.stringify({ menuItemId: item.id, quantity: 1 }),
    });
    const full = await api<Order>(`/orders/${currentOrder.id}`);
    setCurrentOrder(full);
  }

  async function fireKOT() {
    if (!currentOrder) return;
    await api(`/orders/${currentOrder.id}/kot`, { method: "POST" });
    alert("KOT fired to kitchen!");
  }

  async function settleBill() {
    if (!currentOrder) return;
    const result = await api<{ invoice: { invoiceNumber: string } }>(`/orders/${currentOrder.id}/settle`, {
      method: "POST",
      body: JSON.stringify({ payments: [{ method: "cash", amount: Number(currentOrder.totalAmount) }] }),
    });
    alert(`Bill settled! Invoice: ${result.invoice.invoiceNumber}`);
    setCurrentOrder(null);
    setSelectedTable(null);
    loadData();
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button onClick={handleLogin} className="bg-orange-600 px-8 py-3 rounded-lg text-lg font-medium">
          Start POS Session
        </button>
      </div>
    );
  }

  const activeItems = menu.find((c) => c.id === activeCategory)?.items ?? [];

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <h1 className="font-bold text-orange-400">Kaana POS</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className={online ? "text-green-400" : "text-red-400"}>
            {online ? "● Online" : "● Offline"}
          </span>
          {clockRecordId ? (
            <button type="button" onClick={clockOut} className="text-yellow-300 hover:text-yellow-200">Clock out</button>
          ) : (
            <button type="button" onClick={clockIn} className="text-green-300 hover:text-green-200">Clock in</button>
          )}
          {clockMsg && <span className="text-gray-400">{clockMsg}</span>}
          {pendingSync > 0 && <span className="text-yellow-400">{pendingSync} pending sync</span>}
          {selectedTable && <span>Table {selectedTable.number}</span>}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {!selectedTable ? (
          <div className="flex-1 p-4">
            <h2 className="text-lg font-semibold mb-4">Floor Plan</h2>
            <div className="grid grid-cols-4 gap-3">
              {tables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => t.status === "free" && openTable(t)}
                  disabled={t.status !== "free"}
                  className={`p-4 rounded-xl text-center font-medium transition-colors ${TABLE_COLORS[t.status] ?? "bg-gray-700"}`}
                >
                  <div className="text-2xl font-bold">{t.number}</div>
                  <div className="text-xs mt-1 capitalize">{t.status}</div>
                  <div className="text-xs opacity-70">{t.capacity} seats</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="w-64 bg-gray-800 border-r border-gray-700 p-2 overflow-y-auto">
              {menu.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-sm ${activeCategory === cat.id ? "bg-orange-600" : "hover:bg-gray-700"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                {activeItems.filter((i) => i.isAvailable).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addItem(item)}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-left hover:border-orange-500 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-sm ${item.isVeg ? "border-2 border-green-500" : "border-2 border-red-500"}`} />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <p className="text-orange-400 mt-2">₹{Number(item.price).toFixed(0)}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
              <div className="p-4 flex-1 overflow-y-auto">
                <h3 className="font-semibold mb-3">Order {currentOrder?.orderNumber}</h3>
                {currentOrder?.items.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 border-b border-gray-700 text-sm">
                    <span>{item.quantity}x {item.name}</span>
                    <span>₹{Number(item.totalPrice).toFixed(0)}</span>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t border-gray-600 flex justify-between font-bold">
                  <span>Total</span>
                  <span>₹{Number(currentOrder?.totalAmount ?? 0).toFixed(0)}</span>
                </div>
              </div>
              <div className="p-4 space-y-2 border-t border-gray-700">
                <button onClick={fireKOT} className="w-full bg-yellow-600 py-2 rounded-lg font-medium">Fire KOT</button>
                <button onClick={settleBill} className="w-full bg-green-600 py-2 rounded-lg font-medium">Settle Bill</button>
                <button onClick={() => { setSelectedTable(null); setCurrentOrder(null); loadData(); }}
                  className="w-full bg-gray-700 py-2 rounded-lg text-sm">Back to Tables</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function POSPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading POS...</div>}>
      <POSApp />
    </Suspense>
  );
}
