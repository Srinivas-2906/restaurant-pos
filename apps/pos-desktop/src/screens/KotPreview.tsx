import { useParams, useNavigate } from "react-router-dom";
import { KOTPreviewCard } from "@kaana/ui";
import { hub } from "../lib/hub";
import { useEffect, useState } from "react";

export default function KotPreviewScreen() {
  const { orderId } = useParams<{ orderId: string }>();
  const nav = useNavigate();
  const [order, setOrder] = useState<{ items: Array<{ name: string; quantity: number }> } | null>(null);

  useEffect(() => {
    if (orderId) hub<{ items: Array<{ name: string; quantity: number }> }>(`/hub/orders/${orderId}`).then(setOrder);
  }, [orderId]);

  async function fire() {
    if (!orderId) return;
    await hub(`/hub/orders/${orderId}/kot`, { method: "POST" });
    nav(`/order/${orderId}`);
  }

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">KOT Preview</h1>
      <KOTPreviewCard station="All Stations" kotNumber="Preview" items={order?.items ?? []} />
      <div className="flex gap-3 mt-6">
        <button onClick={() => nav(-1)} className="flex-1 py-3 border rounded-lg">Back</button>
        <button onClick={fire} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold">Fire KOT</button>
      </div>
    </div>
  );
}
