import { TrendingDown, TrendingUp } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string | null;
  deltaPositive?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
}

export function MetricCard({ label, value, delta, deltaPositive, icon, loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className="bg-surface-card rounded-xl shadow-card p-5 border border-gray-100 min-h-[120px]">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-8 bg-gray-200 rounded w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-xl shadow-card p-5 border border-gray-100 min-h-[120px] flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {delta !== undefined && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${deltaPositive === true ? "text-green-600" : deltaPositive === false ? "text-red-600" : "text-gray-400"}`}>
            {deltaPositive === true && <TrendingUp className="w-3 h-3" />}
            {deltaPositive === false && <TrendingDown className="w-3 h-3" />}
            {delta ?? "— vs yesterday"}
          </p>
        )}
      </div>
    </div>
  );
}
