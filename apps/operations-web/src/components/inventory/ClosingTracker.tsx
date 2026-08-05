"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface ClosingDay {
  date: string;
  status: string;
}

interface ClosingTrackerProps {
  outletId: string;
  onClosingRecorded?: () => void;
}

export function ClosingTracker({ outletId, onClosingRecorded }: ClosingTrackerProps) {
  const [days, setDays] = useState<ClosingDay[]>([]);
  const month = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    api<ClosingDay[]>(`/inventory/outlets/${outletId}/stock-closings?month=${month}`)
      .then(setDays)
      .catch(() => setDays([]));
  }, [outletId, month, onClosingRecorded]);

  const today = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const closingMap = new Map(days.map((d) => [new Date(d.date).getDate(), d.status]));
  const completed = days.filter((d) => d.status === "completed").length;
  const accuracy = daysInMonth > 0 ? Math.round((completed / Math.min(today, daysInMonth)) * 100) : 0;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Daily stock closing</h3>
          <p className="text-sm text-gray-500">
            {accuracy >= 100 ? "Stock records are up to date." : "Complete daily closings to keep records accurate."}
          </p>
        </div>
        <span className={`text-sm font-medium ${accuracy >= 80 ? "text-green-700" : "text-amber-700"}`}>
          {accuracy}% this month
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const status = closingMap.get(d);
          const isFuture = d > today;
          const cls = isFuture
            ? "bg-gray-100 text-gray-400"
            : status === "completed"
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-red-50 text-red-700 border-red-200";
          return (
            <span
              key={d}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium border ${cls}`}
              title={isFuture ? "Upcoming" : status === "completed" ? "Closed" : "Missed"}
            >
              {d}
            </span>
          );
        })}
      </div>
    </div>
  );
}
