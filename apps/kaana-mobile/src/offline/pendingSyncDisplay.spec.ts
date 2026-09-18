import { describe, expect, it } from "vitest";
import {
  formatPendingSyncHeadline,
  formatPendingSyncMeta,
  labelOutboxOperation,
} from "./pendingSyncDisplay";
import type { PendingSyncOrderSummary } from "./posLocalStore";

const sampleSummary: PendingSyncOrderSummary = {
  localOrderId: "local-1",
  orderNumber: "LOCAL-00001",
  type: "takeaway",
  status: "settled",
  syncStatus: "pending",
  totalAmount: 1000,
  itemCount: 4,
  occurredAt: "2026-09-09T08:17:11.317Z",
  paymentMethod: "cash",
  paymentAmount: 1000,
};

describe("pendingSyncDisplay", () => {
  it("labels outbox operations for cashiers", () => {
    expect(labelOutboxOperation("FIRE_KOT")).toBe("Fire KOT");
    expect(labelOutboxOperation("SETTLE")).toBe("Settle bill");
  });

  it("formats pending sync card headline", () => {
    expect(formatPendingSyncHeadline(sampleSummary)).toBe(
      "CASH sale ₹1,000 — waiting to sync",
    );
  });

  it("formats pending sync card metadata", () => {
    expect(formatPendingSyncMeta(sampleSummary)).toContain("4 items");
    expect(formatPendingSyncMeta(sampleSummary)).toContain("LOCAL-00001");
  });
});
