import React from "react";
import { formatCurrency } from "../utils";

export function OutletHealthCard({ name, city, status, revenue, margin, unsyncedDevices }: {
  name: string; city: string;
  status: "green" | "amber" | "red";
  revenue: number; margin?: number; unsyncedDevices?: number;
}) {
  const dot = { green: "bg-green-500", amber: "bg-yellow-500", red: "bg-red-500" }[status];
  return (
    <div className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-3 h-3 rounded-full ${dot}`} />
        <h3 className="font-semibold">{name}</h3>
      </div>
      <p className="text-sm text-gray-500 mb-3">{city}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><p className="text-gray-400">Revenue</p><p className="font-bold">{formatCurrency(revenue)}</p></div>
        {margin !== undefined && <div><p className="text-gray-400">Margin</p><p className="font-bold">{margin.toFixed(1)}%</p></div>}
        {unsyncedDevices !== undefined && unsyncedDevices > 0 && (
          <div className="col-span-2 text-amber-600 text-xs">{unsyncedDevices} device(s) unsynced</div>
        )}
      </div>
    </div>
  );
}

export function MarginAlertCard({ title, description, amount, severity, onAction }: {
  title: string; description: string; amount: number;
  severity: "warning" | "critical";
  onAction?: () => void;
}) {
  return (
    <div className={`rounded-xl border p-4 ${severity === "critical" ? "border-red-300 bg-red-50" : "border-yellow-300 bg-yellow-50"}`}>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
      <p className={`font-bold mt-2 ${amount < 0 ? "text-red-600" : "text-gray-900"}`}>
        {amount < 0 ? `Losing ${formatCurrency(Math.abs(amount))}/order` : formatCurrency(amount)}
      </p>
      {onAction && (
        <button onClick={onAction} className="mt-3 text-sm text-orange-600 font-medium hover:underline">Fix price →</button>
      )}
    </div>
  );
}

export function RecommendationCard({ title, prediction, actions, status, onApprove, onDismiss }: {
  title: string; prediction: string;
  actions: string[];
  status: "pending" | "approved" | "completed";
  onApprove?: () => void; onDismiss?: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-lg">{title}</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${
          status === "pending" ? "bg-yellow-100 text-yellow-800" :
          status === "approved" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
        }`}>{status}</span>
      </div>
      <p className="text-sm text-gray-600 mt-2">{prediction}</p>
      <ul className="mt-3 space-y-1">
        {actions.map((a, i) => <li key={i} className="text-sm flex items-center gap-2"><span className="text-orange-500">→</span>{a}</li>)}
      </ul>
      {status === "pending" && onApprove && (
        <div className="flex gap-2 mt-4">
          <button onClick={onApprove} className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-medium">Approve</button>
          {onDismiss && <button onClick={onDismiss} className="px-4 py-2 border rounded-lg">Dismiss</button>}
        </div>
      )}
    </div>
  );
}

export function DeviceHealthRow({ name, type, status, syncBacklog, lastSeen }: {
  name: string; type: string; status: string; syncBacklog: number; lastSeen?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-xs text-gray-500">{type} · {lastSeen ? `Last seen ${lastSeen}` : "Never"}</p>
      </div>
      <div className="text-right">
        <span className={`text-xs px-2 py-1 rounded-full ${status === "online" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{status}</span>
        {syncBacklog > 0 && <p className="text-xs text-amber-600 mt-1">{syncBacklog} pending sync</p>}
      </div>
    </div>
  );
}
