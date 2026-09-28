import { describe, expect, it, vi } from "vitest";
import { refreshWithOfflineFallback } from "./offlineResourceRefresh";

describe("refreshWithOfflineFallback", () => {
  it("returns cached floor when API is unavailable", async () => {
    const cached = [{ id: "t1", number: "1", status: "free", capacity: 4 }];
    const result = await refreshWithOfflineFallback({
      outletId: "outlet-a",
      label: "FLOOR",
      emptyValue: [],
      probeReachability: async () => false,
      fetchRemote: vi.fn(),
      loadCache: async () => cached,
      isEmpty: (rows) => rows.length === 0,
      persistCache: async () => {},
    });

    expect(result.source).toBe("cache");
    expect(result.data).toEqual(cached);
  });

  it("times out remote fetch and uses cached open orders", async () => {
    const cached = [{ id: "o1", status: "open", orderNumber: "1001" }];
    const result = await refreshWithOfflineFallback({
      outletId: "outlet-a",
      label: "ORDERS",
      emptyValue: [],
      probeReachability: async () => true,
      fetchRemote: () => new Promise<typeof cached>(() => {}),
      loadCache: async () => cached,
      isEmpty: (rows) => rows.length === 0,
      persistCache: async () => {},
      remoteTimeoutMs: 25,
      probeTimeoutMs: 25,
    });

    expect(result.source).toBe("cache");
    expect(result.data).toEqual(cached);
  });

  it("returns empty list when offline with no cache instead of hanging", async () => {
    const result = await refreshWithOfflineFallback({
      outletId: "outlet-a",
      label: "ORDERS",
      emptyValue: [] as Array<{ id: string }>,
      probeReachability: async () => false,
      fetchRemote: async () => [],
      loadCache: async () => [],
      isEmpty: (rows) => rows.length === 0,
      persistCache: async () => {},
    });

    expect(result.source).toBe("none");
    expect(result.data).toEqual([]);
    expect(result.readError).toBeNull();
  });
});
