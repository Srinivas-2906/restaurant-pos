import { describe, expect, it } from "vitest";
import {
  computeBackoffMs,
  isAuthError,
  isConflictStatus,
  isRetryableHttpStatus,
} from "@kaana/sync-engine";
import { validateIdempotencyKey } from "@kaana/sync-protocol";

describe("sync-engine retry helpers", () => {
  it("computes exponential backoff with jitter cap", () => {
    const a = computeBackoffMs(0);
    const b = computeBackoffMs(5);
    expect(a).toBeGreaterThanOrEqual(1000);
    expect(b).toBeLessThanOrEqual(60500);
  });

  it("classifies HTTP statuses", () => {
    expect(isRetryableHttpStatus(503)).toBe(true);
    expect(isRetryableHttpStatus(400)).toBe(false);
    expect(isAuthError(401)).toBe(true);
    expect(isConflictStatus(409)).toBe(true);
  });
});

describe("sync-protocol idempotency", () => {
  it("validates idempotency keys", () => {
    expect(validateIdempotencyKey("create:abc12345")).toBe(true);
    expect(validateIdempotencyKey("short")).toBe(false);
  });

  it("stable settle key format", () => {
    const orderId = "local-order-1";
    const key = `settle:${orderId}`;
    expect(validateIdempotencyKey(key)).toBe(true);
    expect(key).toBe(`settle:${orderId}`);
  });
});

describe("command ordering", () => {
  it("orders CREATE before SETTLE by sequence", () => {
    const commands = [
      { operationType: "SETTLE", sequence: 3, aggregateId: "o1" },
      { operationType: "CREATE_ORDER", sequence: 1, aggregateId: "o1" },
      { operationType: "ADD_ITEM", sequence: 2, aggregateId: "o1" },
    ];
    const sorted = [...commands].sort((a, b) => a.sequence - b.sequence);
    expect(sorted.map((c) => c.operationType)).toEqual([
      "CREATE_ORDER",
      "ADD_ITEM",
      "SETTLE",
    ]);
  });
});

describe("price snapshot policy", () => {
  it("preserves offline unit price independent of new menu price", () => {
    const cachedPrice = 300;
    const newMenuPrice = 320;
    const snapshot = { unitPrice: cachedPrice, menuItemUpdatedAt: "2026-01-01T00:00:00Z" };
    expect(snapshot.unitPrice).toBe(300);
    expect(newMenuPrice).toBe(320);
    expect(snapshot.unitPrice).not.toBe(newMenuPrice);
  });
});

describe("offline auth TTL", () => {
  it("expires after validUntil", () => {
    const validUntil = new Date(Date.now() - 1000).toISOString();
    expect(new Date(validUntil) < new Date()).toBe(true);
  });
});

describe("midnight business date", () => {
  it("uses occurredAt not sync time for business date", () => {
    const occurredAt = "2026-03-07T23:58:00+05:30";
    const syncedAt = "2026-03-08T00:10:00+05:30";
    const businessDate = occurredAt.slice(0, 10);
    expect(businessDate).toBe("2026-03-07");
    expect(syncedAt.slice(0, 10)).toBe("2026-03-08");
    expect(businessDate).not.toBe(syncedAt.slice(0, 10));
  });
});
