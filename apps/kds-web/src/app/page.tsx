"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import { api, login } from "@/lib/api";

interface KOT {
  id: string;
  kotNumber: string;
  status: string;
  firedAt: string;
  kitchenStation: { name: string; code: string };
  order: { table?: { number: string }; orderNumber: string };
  items: Array<{ quantity: number; orderItem: { name: string } }>;
}

function KDSApp() {
  const searchParams = useSearchParams();
  const outletId = searchParams.get("outletId") || "";
  const stationId = searchParams.get("stationId") || "";
  const [kots, setKots] = useState<KOT[]>([]);
  const [aggregated, setAggregated] = useState<Array<{ name: string; _sum: { quantity: number | null } }>>([]);
  const [ready, setReady] = useState(false);

  const loadKots = useCallback(async () => {
    if (!stationId) return;
    const data = await api<KOT[]>(`/kds/stations/${stationId}/queue`);
    setKots(data);
  }, [stationId]);

  useEffect(() => {
    async function init() {
      if (!localStorage.getItem("token")) await login();
      setReady(true);
    }
    init();
  }, []);

  useEffect(() => {
    if (!ready || !stationId) return;
    loadKots();
    if (outletId) {
      api<Array<{ name: string; _sum: { quantity: number | null } }>>(`/kds/outlets/${outletId}/aggregated`).then(setAggregated).catch(console.error);
    }

    const socket = io("http://localhost:4000/events");
    socket.emit("join", { channel: `station:${stationId}:kots` });
    socket.on("kot:update", () => loadKots());

    const interval = setInterval(loadKots, 5000);
    return () => { socket.disconnect(); clearInterval(interval); };
  }, [ready, stationId, outletId, loadKots]);

  async function markReady(kotId: string) {
    await api(`/kds/kot/${kotId}/ready`, { method: "PATCH" });
    loadKots();
  }

  if (!ready) return <div className="h-screen flex items-center justify-center">Loading KDS...</div>;

  if (!stationId) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-400">Add ?outletId=...&stationId=... to URL</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-gray-900 px-6 py-3 flex justify-between items-center border-b border-gray-800">
        <h1 className="text-xl font-bold text-orange-400">Kaana KDS</h1>
        <span className="text-gray-400">{kots.length} active tickets</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kots.map((kot) => (
              <div key={kot.id} className={`rounded-xl p-4 border-2 ${kot.status === "preparing" ? "border-yellow-500 bg-yellow-950" : "border-orange-500 bg-gray-900"}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-lg">{kot.kotNumber}</p>
                    <p className="text-sm text-gray-400">
                      {kot.order.table ? `Table ${kot.order.table.number}` : kot.order.orderNumber}
                    </p>
                  </div>
                  <span className="text-xs bg-gray-800 px-2 py-1 rounded capitalize">{kot.status}</span>
                </div>
                <div className="space-y-2 mb-4">
                  {kot.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.orderItem.name}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => markReady(kot.id)}
                  className="w-full bg-green-600 hover:bg-green-500 py-2 rounded-lg font-medium"
                >
                  Mark Ready
                </button>
              </div>
            ))}
            {kots.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-20">
                No pending KOTs — kitchen is clear!
              </div>
            )}
          </div>
        </div>

        <div className="w-64 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-3 text-sm text-gray-400 uppercase">Item Summary</h3>
          {aggregated.map((item) => (
            <div key={item.name} className="flex justify-between py-2 border-b border-gray-800 text-sm">
              <span>{item.name}</span>
              <span className="font-bold text-orange-400">{item._sum.quantity ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function KDSPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}>
      <KDSApp />
    </Suspense>
  );
}
