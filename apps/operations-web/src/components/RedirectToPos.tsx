"use client";

import { useEffect } from "react";
import { buildPosLink, readAuthHandoffFromStorage } from "@kaana/role-shells";
import { DisabledFeatureRoute } from "@kaana/ui";
import { getOutletId } from "@/lib/api";
import { useCapabilities } from "@/contexts/CapabilitiesContext";

interface RedirectToPosProps {
  path?: string;
}

/** Sends owner/manager to POS inventory with the same login session. */
export function RedirectToPos({ path = "/inventory" }: RedirectToPosProps) {
  const { capabilities, ready } = useCapabilities();

  const inventoryDisabled = ready && capabilities?.modules.inventory === false;
  const procurementDisabled = ready && path.startsWith("/purchases") && capabilities?.modules.procurement === false;
  const transfersDisabled =
    ready &&
    path.includes("/transfers") &&
    capabilities?.features?.["inventory.stock_transfer"] !== true;

  useEffect(() => {
    if (!ready || inventoryDisabled || procurementDisabled || transfersDisabled) return;

    const handoff = readAuthHandoffFromStorage();
    if (!handoff) {
      window.location.href = "/";
      return;
    }
    const outletId = getOutletId();
    window.location.href = buildPosLink(path, { ...handoff, outletId: outletId ?? handoff.outletId });
  }, [path, ready, inventoryDisabled, procurementDisabled, transfersDisabled]);

  if (!ready) {
    return (
      <div className="p-8 text-center text-gray-500">Loading restaurant configuration…</div>
    );
  }

  if (transfersDisabled) {
    return (
      <DisabledFeatureRoute
        featureLabel="Stock transfers"
        reason="Stock transfers are not enabled for your restaurant."
      />
    );
  }

  if (inventoryDisabled || procurementDisabled) {
    return (
      <DisabledFeatureRoute
        featureLabel={procurementDisabled ? "Purchases" : "Inventory"}
        reason={
          procurementDisabled
            ? "Purchases are not enabled for your restaurant."
            : "Inventory is not enabled for your restaurant."
        }
      />
    );
  }

  return (
    <div className="p-8 text-center text-gray-500">
      Opening store & inventory in POS…
    </div>
  );
}
