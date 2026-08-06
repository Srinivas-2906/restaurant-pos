"use client";

import { useEffect } from "react";
import { buildPosLink, readAuthHandoffFromStorage } from "@kaana/role-shells";
import { getOutletId } from "@/lib/api";

interface RedirectToPosProps {
  path?: string;
}

/** Sends owner/manager to POS inventory with the same login session. */
export function RedirectToPos({ path = "/inventory" }: RedirectToPosProps) {
  useEffect(() => {
    const handoff = readAuthHandoffFromStorage();
    if (!handoff) {
      window.location.href = "/";
      return;
    }
    const outletId = getOutletId();
    window.location.href = buildPosLink(path, { ...handoff, outletId: outletId ?? handoff.outletId });
  }, [path]);

  return (
    <div className="p-8 text-center text-gray-500">
      Opening store & inventory in POS…
    </div>
  );
}
