"use client";

import { useEffect, useState } from "react";
import { getOutletId, loadOrganizationOutlets, setSelectedOutletId, type OutletSummary } from "@/lib/api";

export function OutletSelector({ onChange }: { onChange?: (outletId: string) => void }) {
  const [outlets, setOutlets] = useState<OutletSummary[]>([]);
  const [outletId, setOutletId] = useState("");

  useEffect(() => {
    loadOrganizationOutlets()
      .then((list) => {
        setOutlets(list);
        const current = getOutletId();
        if (current && list.some((o) => o.id === current)) {
          setOutletId(current);
        } else if (list[0]) {
          setSelectedOutletId(list[0].id);
          setOutletId(list[0].id);
          onChange?.(list[0].id);
        }
      })
      .catch(() => {});
  }, [onChange]);

  if (outlets.length <= 1) return null;

  return (
    <select
      value={outletId}
      onChange={(e) => {
        setSelectedOutletId(e.target.value);
        setOutletId(e.target.value);
        onChange?.(e.target.value);
      }}
      className="text-xs border border-slate-200 rounded-md px-2 py-1 max-w-[160px] truncate bg-white"
      aria-label="Select outlet"
    >
      {outlets.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
