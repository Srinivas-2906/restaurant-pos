"use client";

import { CheckCircle2, XCircle } from "lucide-react";

export function Toast({ message, type }: { message: string; type: "ok" | "err" }) {
  if (!message) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium transition-all ${
        type === "ok"
          ? "bg-emerald-600 text-white ring-1 ring-emerald-500/50"
          : "bg-red-600 text-white ring-1 ring-red-500/50"
      }`}
    >
      {type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
      {message}
    </div>
  );
}
