export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

export const TABLE_STATUS_COLORS: Record<string, string> = {
  free: "bg-green-100 border-green-400 text-green-800",
  ordering: "bg-orange-100 border-orange-400 text-orange-800",
  seated: "bg-orange-100 border-orange-400 text-orange-800",
  billed: "bg-blue-100 border-blue-400 text-blue-800",
  blocked: "bg-gray-100 border-gray-400 text-gray-500",
  reserved: "bg-purple-100 border-purple-400 text-purple-800",
  ready_to_serve: "bg-emerald-100 border-emerald-500 text-emerald-900",
  serving: "bg-teal-100 border-teal-400 text-teal-900",
  kitchen: "bg-amber-100 border-amber-400 text-amber-900",
  cleaning: "bg-sky-100 border-sky-300 text-sky-800",
};
