"use client";

import type { OrderDto } from "@kaana/shared-types";
import { getOutletBillingMode } from "@kaana/shared-types";
import { formatInr } from "@/lib/api";

export function CaptainBillActions({
  order,
  outletSettings,
  onRequestBill,
  onSettle,
  busy,
}: {
  order: OrderDto;
  outletSettings?: Record<string, unknown>;
  onRequestBill: () => void;
  onSettle?: () => void;
  busy?: boolean;
}) {
  const billingMode = getOutletBillingMode(outletSettings);
  const canSettle = billingMode === "captain_can_settle";
  const billRequested = Boolean(order.billRequestedAt);

  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t">
      {!billRequested ? (
        <button
          type="button"
          disabled={busy || order.items.length === 0}
          onClick={onRequestBill}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          Request bill
        </button>
      ) : (
        <span className="text-sm text-violet-700 font-medium py-2">Bill requested — cashier notified</span>
      )}
      {canSettle && onSettle && (
        <button
          type="button"
          disabled={busy}
          onClick={onSettle}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          Settle {formatInr(order.totalAmount)}
        </button>
      )}
    </div>
  );
}
