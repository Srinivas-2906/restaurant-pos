import { Link } from "react-router-dom";

export default function InboxScreen() {
  const orders = [
    { id: "agg-1", source: "Swiggy", items: "2x Biryani", sla: "8 min", status: "new" },
    { id: "agg-2", source: "Zomato", items: "1x Thali", sla: "12 min", status: "new" },
  ];

  return (
    <div className="min-h-screen p-4">
      <div className="flex justify-between mb-4">
        <h1 className="text-xl font-bold">Order Inbox</h1>
        <Link to="/floor" className="text-orange-600">← Floor</Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">Aggregator & phone orders — accept to auto-fire KOT</p>
      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="bg-white border rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{o.source}</p>
              <p className="text-sm text-gray-500">{o.items}</p>
              <p className="text-xs text-red-500">SLA: {o.sla}</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Accept</button>
              <button className="px-4 py-2 border rounded-lg text-sm">Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
