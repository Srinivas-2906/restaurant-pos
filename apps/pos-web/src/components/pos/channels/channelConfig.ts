export type OrderSource =
  | "dine_in"
  | "swiggy"
  | "zomato"
  | "website"
  | "phone"
  | "walk_in";

export type OrderType = "dine_in" | "takeaway" | "delivery";

export interface ChannelMeta {
  label: string;
  badgeClass: string;
  isAggregator: boolean;
}

export const ORDER_SOURCE_META: Record<OrderSource, ChannelMeta> = {
  dine_in: { label: "Dine-in", badgeClass: "bg-slate-100 text-slate-700", isAggregator: false },
  swiggy: { label: "Swiggy", badgeClass: "bg-orange-100 text-orange-800", isAggregator: true },
  zomato: { label: "Zomato", badgeClass: "bg-red-100 text-red-800", isAggregator: true },
  website: { label: "Website", badgeClass: "bg-violet-100 text-violet-800", isAggregator: true },
  phone: { label: "Phone", badgeClass: "bg-blue-100 text-blue-800", isAggregator: false },
  walk_in: { label: "Walk-in", badgeClass: "bg-emerald-100 text-emerald-800", isAggregator: false },
};

export const ORDER_TYPE_META: Record<OrderType, { label: string; icon: string }> = {
  dine_in: { label: "Dine-in", icon: "🍽️" },
  takeaway: { label: "Takeaway", icon: "🥡" },
  delivery: { label: "Delivery", icon: "🛵" },
};

export const PARTNER_WEBHOOK_PATH = "/api/v1/orders/save";

export const INTEGRATION_PARTNERS = [
  {
    id: "swiggy" as const,
    name: "Swiggy",
    color: "border-orange-200 bg-orange-50",
    dot: "bg-[#FF5200]",
    webhookField: "restId",
    simulatePath: (outletId: string) => `/v1/simulate/${outletId}/swiggy`,
  },
  {
    id: "zomato" as const,
    name: "Zomato",
    color: "border-red-200 bg-red-50",
    dot: "bg-[#E23744]",
    webhookField: "restId",
    simulatePath: (outletId: string) => `/v1/simulate/${outletId}/zomato`,
  },
] as const;
