import React from "react";

export * from "./tokens";
export * from "./utils";
export * from "./brand";
export { KaanaLogo, KaanaBrand } from "./components/KaanaLogo";
export type { KaanaLogoSize } from "./components/KaanaLogo";
export { StaffLoginForm } from "./components/StaffLoginForm";
export type { StaffLoginAccent } from "./components/StaffLoginForm";
export { SyncBadge, TableCard, MenuItemGrid, OrderCart, KOTPreviewCard } from "./components/pos";
export { KOTCard, AggregatedItemRow, StationSelector, KDSBoard, TableKOTCard, TableTicketTile, groupKotsByTable } from "./components/kds";
export type { KdsQueueItem, TableKOTGroup, TableOrderSection, KdsBoardFilter } from "./components/kds";
export { OutletHealthCard, MarginAlertCard, RecommendationCard, DeviceHealthRow } from "./components/owner";

export function Button({ children, onClick, variant = "primary", disabled, className = "", size = "md" }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const variants = {
    primary: "bg-orange-600 hover:bg-orange-700 text-white",
    secondary: "bg-gray-200 hover:bg-gray-300 text-gray-900",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    ghost: "bg-transparent hover:bg-gray-100 text-gray-700",
  };
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2", lg: "px-6 py-3 text-lg" };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-medium transition-colors disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${className}`}>{children}</div>;
}

export function Badge({ children, color = "gray" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    orange: "bg-orange-100 text-orange-700",
    blue: "bg-blue-100 text-blue-700",
    yellow: "bg-yellow-100 text-yellow-800",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] ?? colors.gray}`}>{children}</span>;
}

export function StatCard({ label, value, sub, trend }: { label: string; value: string | number; sub?: string; trend?: "up" | "down" }) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className={`text-xs mt-1 ${trend === "down" ? "text-red-500" : trend === "up" ? "text-green-500" : "text-gray-400"}`}>{sub}</p>}
    </Card>
  );
}

export { formatCurrency, TABLE_STATUS_COLORS } from "./utils";
export { AppToaster, notify, notifyOrderUpdate } from "./notifications";
export type { NotifyType, ToastItem, OrderUpdatePayload, NotifyAppRole } from "./notifications";
