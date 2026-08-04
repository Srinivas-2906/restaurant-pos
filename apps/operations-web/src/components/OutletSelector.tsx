"use client";

import { useEffect, useState } from "react";
import { getUser, getOutletId, setSelectedOutletId } from "@/lib/api";

export function OutletSelector() {
  const user = getUser();
  const [outletId, setOutletId] = useState<string>("");
  const outlets = user?.roles?.filter((r) => r.outletId).map((r) => r.outletId!) ?? [];
  const uniqueOutlets = [...new Set(outlets)];

  useEffect(() => {
    const current = getOutletId();
    if (current) setOutletId(current);
    else if (uniqueOutlets[0]) {
      setSelectedOutletId(uniqueOutlets[0]);
      setOutletId(uniqueOutlets[0]);
    }
  }, [uniqueOutlets]);

  if (uniqueOutlets.length <= 1) return null;

  return (
    <select
      value={outletId}
      onChange={(e) => {
        setSelectedOutletId(e.target.value);
        setOutletId(e.target.value);
        window.location.reload();
      }}
      className="text-sm border rounded-lg px-2 py-1"
    >
      {uniqueOutlets.map((id) => (
        <option key={id} value={id}>Outlet {id.slice(-6)}</option>
      ))}
    </select>
  );
}
