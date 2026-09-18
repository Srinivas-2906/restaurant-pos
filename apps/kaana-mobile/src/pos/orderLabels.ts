const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  kot_fired: "Sent to kitchen",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  billed: "Bill printed",
  settled: "Settled",
  cancelled: "Cancelled",
  voided: "Voided",
};

export function orderStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: "Dine In",
  takeaway: "Takeaway",
  delivery: "Delivery",
};
