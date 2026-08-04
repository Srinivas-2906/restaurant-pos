import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatCurrency } from "@kaana/ui";
import { hub } from "../lib/hub";

export default function PaymentScreen() {
  const { orderId } = useParams<{ orderId: string }>();
  const nav = useNavigate();
  const [order, setOrder] = useState<{ totalAmount: number } | null>(null);
  const [method, setMethod] = useState("cash");

  useEffect(() => {
    if (orderId) hub<{ totalAmount: number }>(`/hub/orders/${orderId}`).then(setOrder);
  }, [orderId]);

  async function settle() {
    if (!orderId || !order) return;
    await hub(`/hub/orders/${orderId}/settle`, {
      method: "POST",
      body: JSON.stringify({ payments: [{ method, amount: order.totalAmount }] }),
    });
    nav("/floor");
  }

  return (
    <div className="min-h-screen p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Settle Bill</h1>
      <p className="text-3xl font-bold mb-6">{order ? formatCurrency(order.totalAmount) : "—"}</p>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {["cash", "upi", "card"].map((m) => (
          <button key={m} onClick={() => setMethod(m)}
            className={`py-4 rounded-lg border capitalize font-medium ${method === m ? "border-orange-500 bg-orange-50" : ""}`}>{m}</button>
        ))}
      </div>
      <button onClick={settle} className="w-full py-4 bg-orange-600 text-white rounded-lg font-bold">Print & Settle</button>
    </div>
  );
}
