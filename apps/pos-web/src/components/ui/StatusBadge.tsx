const STATUS_STYLES: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  kot_fired: "bg-amber-100 text-amber-800",
  preparing: "bg-amber-100 text-amber-800",
  confirmed: "bg-indigo-100 text-indigo-800",
  settled: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  pending: "bg-gray-100 text-gray-700",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  const style = STATUS_STYLES[key] ?? "bg-gray-100 text-gray-700";
  const display = label ?? status.replace(/_/g, " ");

  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${style}`}>
      {display}
    </span>
  );
}
