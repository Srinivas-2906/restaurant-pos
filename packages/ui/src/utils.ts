export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

export const TABLE_STATUS_COLORS: Record<string, string> = {
  free: "bg-green-100 border-green-400 text-green-800",
  seated: "bg-orange-100 border-orange-400 text-orange-800",
  billed: "bg-blue-100 border-blue-400 text-blue-800",
  blocked: "bg-gray-100 border-gray-400 text-gray-500",
  reserved: "bg-purple-100 border-purple-400 text-purple-800",
};
