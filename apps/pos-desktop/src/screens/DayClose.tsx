import { Link } from "react-router-dom";

export default function DayCloseScreen() {
  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto">
      <div className="flex justify-between mb-6">
        <h1 className="text-xl font-bold">Day Close</h1>
        <Link to="/floor" className="text-orange-600">← Floor</Link>
      </div>
      <div className="space-y-4">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-sm text-gray-500">Cash in drawer</p>
          <input type="number" placeholder="Count cash" className="w-full mt-2 p-3 border rounded-lg" />
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="font-medium">Payment reconciliation</p>
          <p className="text-sm text-gray-500 mt-1">Cash: ₹12,400 · UPI: ₹28,600 · Card: ₹8,200</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm">
          0 unsettled orders — safe to close
        </div>
        <button className="w-full py-4 bg-gray-900 text-white rounded-lg font-bold">Generate Z-Report</button>
      </div>
    </div>
  );
}
