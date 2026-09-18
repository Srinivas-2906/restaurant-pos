import { describe, expect, it, vi } from "vitest";
import type { MenuCategory } from "@kaana/api-client";
import {
  INTERNET_REQUIRED_MENU_MESSAGE,
  LOCAL_MENU_READ_ERROR_MESSAGE,
  refreshPosMenu,
  withTimeout,
} from "./menuRefresh";

const sampleMenu: MenuCategory[] = [
  {
    id: "cat-1",
    name: "Mains",
    items: [
      {
        id: "item-1",
        name: "Chicken Biryani",
        basePrice: 300,
        isAvailable: true,
        isVeg: false,
      },
    ],
  },
];

describe("withTimeout", () => {
  it("rejects when the promise hangs", async () => {
    await expect(
      withTimeout(new Promise<never>(() => {}), 20, "menu fetch"),
    ).rejects.toThrow("menu fetch timed out after 20ms");
  });
});

describe("refreshPosMenu", () => {
  it("A. online + server success renders remote + writes cache", async () => {
    const persist = vi.fn(async () => {});
    const result = await refreshPosMenu({
      outletId: "outlet-a",
      probeReachability: async () => true,
      fetchRemoteMenu: async () => sampleMenu,
      loadCachedMenu: async () => [],
      persistMenuCache: persist,
    });

    expect(result.source).toBe("remote");
    expect(result.menu).toEqual(sampleMenu);
    expect(persist).toHaveBeenCalledWith("outlet-a", sampleMenu);
  });

  it("B. API unavailable + cache populated renders cached menu", async () => {
    const fetchRemoteMenu = vi.fn(async () => sampleMenu);
    const result = await refreshPosMenu({
      outletId: "outlet-a",
      probeReachability: async () => false,
      fetchRemoteMenu,
      loadCachedMenu: async () => sampleMenu,
      persistMenuCache: async () => {},
    });

    expect(result.source).toBe("cache");
    expect(result.menu).toEqual(sampleMenu);
    expect(fetchRemoteMenu).not.toHaveBeenCalled();
  });

  it("C. API unavailable + no cache shows internet-required state", async () => {
    const result = await refreshPosMenu({
      outletId: "outlet-a",
      probeReachability: async () => false,
      fetchRemoteMenu: async () => sampleMenu,
      loadCachedMenu: async () => [],
      persistMenuCache: async () => {},
    });

    expect(result.source).toBe("none");
    expect(result.menu).toEqual([]);
    expect(result.blockedMessage).toBe(INTERNET_REQUIRED_MENU_MESSAGE);
  });

  it("D. server request hangs times out then uses cached menu", async () => {
    const result = await refreshPosMenu({
      outletId: "outlet-a",
      probeReachability: async () => true,
      fetchRemoteMenu: () => new Promise<MenuCategory[]>(() => {}),
      loadCachedMenu: async () => sampleMenu,
      persistMenuCache: async () => {},
      remoteTimeoutMs: 25,
      probeTimeoutMs: 25,
    });

    expect(result.source).toBe("cache");
    expect(result.menu).toEqual(sampleMenu);
  });

  it("E. cached menu read error returns explicit local-data error", async () => {
    const result = await refreshPosMenu({
      outletId: "outlet-a",
      probeReachability: async () => false,
      fetchRemoteMenu: async () => sampleMenu,
      loadCachedMenu: async () => {
        throw new Error("sqlite locked");
      },
      persistMenuCache: async () => {},
    });

    expect(result.source).toBe("none");
    expect(result.blockedMessage).toBe(LOCAL_MENU_READ_ERROR_MESSAGE);
  });

  it("F. outlet cache key mismatch returns empty cache", async () => {
    const loadCachedMenu = vi.fn(async (outletId: string) => {
      if (outletId === "outlet-a") return sampleMenu;
      return [];
    });

    const result = await refreshPosMenu({
      outletId: "outlet-b",
      probeReachability: async () => false,
      fetchRemoteMenu: async () => sampleMenu,
      loadCachedMenu,
      persistMenuCache: async () => {},
    });

    expect(loadCachedMenu).toHaveBeenCalledWith("outlet-b");
    expect(result.source).toBe("none");
    expect(result.blockedMessage).toBe(INTERNET_REQUIRED_MENU_MESSAGE);
  });
});
