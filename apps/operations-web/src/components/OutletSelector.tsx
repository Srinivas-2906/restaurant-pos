"use client";

import { useEffect, useState } from "react";
import { getUser, getOutletId, setSelectedOutletId, loadOrganizationOutlets, type OutletSummary } from "@/lib/api";

export function OutletSelector() {
  const [mounted, setMounted] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [outletId, setOutletId] = useState<string>("");
  const [outlets, setOutlets] = useState<OutletSummary[]>([]);

  useEffect(() => {
    const user = getUser();
    setIsOwner(user?.roles?.some((r) => r.role === "owner") ?? false);
    loadOrganizationOutlets()
      .then((list) => {
        setOutlets(list);
        const current = getOutletId();
        if (current && list.some((o) => o.id === current)) {
          setOutletId(current);
        } else if (list[0]) {
          setSelectedOutletId(list[0].id);
          setOutletId(list[0].id);
        }
      })
      .catch(() => {});
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!isOwner && outlets.length <= 1) return null;
  if (outlets.length === 0) return null;

  return (
    <select
      value={outletId}
      onChange={(e) => {
        setSelectedOutletId(e.target.value);
        setOutletId(e.target.value);
        window.location.reload();
      }}
      className="text-sm border rounded-lg px-2 py-1 max-w-[200px] truncate"
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
