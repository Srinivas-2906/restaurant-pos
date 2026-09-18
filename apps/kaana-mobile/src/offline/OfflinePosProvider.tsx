import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import type { FloorTable, MenuCategory, OrderDetail, OrderSummary } from "@kaana/api-client";
import { usePos } from "../pos/PosProvider";
import { useSession } from "../session/SessionProvider";
import {
  createLocalOrder,
  addLocalItem,
  fireLocalKot,
  settleLocalOrder,
  getLocalOrder,
  cacheMenuFromApi,
  cacheFloorFromApi,
  cacheOpenOrdersFromApi,
  loadCachedMenu,
  loadCachedFloor,
  loadCachedOpenOrders,
  type LocalOrder,
} from "./posLocalStore";
import {
  runSyncWorker,
  scheduleSyncWithBackoff,
  subscribeSyncState,
  checkApiReachability,
  getLastSyncLabel,
  setConnectivityOnline,
  type SyncConnectivityState,
} from "./syncWorker";
import { getOfflineDb } from "./database";
import { refreshPosMenu } from "./menuRefresh";
import { refreshWithOfflineFallback } from "./offlineResourceRefresh";
import { probeStableApiReachability } from "./connectivityProbe";
import { ACTIVE_ORDER_STATUSES } from "../pos/types";

type OfflinePosContextValue = {
  isOffline: boolean;
  syncState: SyncConnectivityState;
  pendingCount: number;
  syncBlockedMessage: string | null;
  lastSyncLabel: string | null;
  menuReady: boolean;
  menuBlockedMessage: string | null;
  refreshMenu: () => Promise<MenuCategory[]>;
  refreshFloor: () => Promise<FloorTable[]>;
  refreshOpenOrders: () => Promise<OrderSummary[]>;
  createOrder: (data: { type: string; tableId?: string; guestCount?: number }) => Promise<LocalOrder>;
  addItem: (orderId: string, item: {
    menuItemId: string; name: string; unitPrice: number; taxRate: number; quantity?: number;
    menuItemUpdatedAt?: string;
  }) => Promise<LocalOrder>;
  fireKot: (orderId: string) => Promise<LocalOrder>;
  settle: (orderId: string, data: {
    payments: Array<{ method: string; amount: number }>;
    discountAmount?: number;
    idempotencyKey: string;
  }) => Promise<LocalOrder>;
  getOrder: (orderId: string) => Promise<LocalOrder | null>;
  toOrderDetail: (local: LocalOrder) => OrderDetail;
  triggerSync: () => Promise<void>;
};

const OfflinePosContext = createContext<OfflinePosContextValue | null>(null);

function localToOrderDetail(local: LocalOrder): OrderDetail {
  return {
    id: local.cloudId ?? local.id,
    orderNumber: local.orderNumber,
    outletId: local.outletId,
    type: local.type as OrderDetail["type"],
    source: "pos",
    status: local.status === "settled" ? "settled" : local.status === "kot_fired" ? "kot_fired" : "open",
    subtotal: String(local.subtotal),
    taxAmount: String(local.taxAmount),
    discountAmount: String(local.discountAmount),
    totalAmount: String(local.totalAmount),
    guestCount: 1,
    items: local.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: String(i.unitPrice),
      taxAmount: String(i.taxAmount),
      totalPrice: String(i.totalPrice),
      status: i.status,
      kotId: i.kotId ?? undefined,
    })),
    table: local.tableId ? { id: local.tableId, number: local.tableId } : undefined,
    kots: [],
    createdAt: local.occurredAt,
    updatedAt: local.occurredAt,
  } as OrderDetail;
}

export function OfflinePosProvider({ children }: { children: React.ReactNode }) {
  const pos = usePos();
  const { employee } = useSession();
  const [syncState, setSyncState] = useState<SyncConnectivityState>("ONLINE");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncLabel, setLastSyncLabel] = useState<string | null>(null);
  const [menuReady, setMenuReady] = useState(true);
  const [menuBlockedMessage, setMenuBlockedMessage] = useState<string | null>(null);
  const [apiReachable, setApiReachable] = useState(true);
  const requiresOnlineLogin = employee?.accessToken === "offline-session";
  const syncBlockedMessage =
    requiresOnlineLogin && pendingCount > 0
      ? "Sign in with PIN while online to sync pending sales."
      : null;

  const deviceId = useMemo(
    () => (pos.terminalId ? `mobile:${pos.terminalId}` : "mobile:unknown"),
    [pos.terminalId],
  );

  const actor = useMemo(() => ({
    staffProfileId: employee?.staff.id ?? "unknown",
    employeeCode: employee?.staff.employeeCode ?? "unknown",
    terminalId: pos.terminalId ?? employee?.terminalId ?? "",
    outletId: pos.outletId,
    permissions: employee?.staff.permissions ?? pos.permissions.permissions,
    role: employee?.staff.role ?? "biller",
  }), [employee, pos.terminalId, pos.outletId, pos.permissions]);

  const applyMenuRefreshResult = useCallback((result: Awaited<ReturnType<typeof refreshPosMenu>>) => {
    setMenuReady(result.menuReady);
    setMenuBlockedMessage(result.blockedMessage);
  }, []);

  const devLog =
    typeof __DEV__ !== "undefined" && __DEV__
      ? (message: string) => console.log(message)
      : undefined;

  const refreshMenu = useCallback(async (): Promise<MenuCategory[]> => {
    const refreshParams = {
      outletId: pos.outletId,
      ensureDbReady: getOfflineDb,
      probeReachability: () => checkApiReachability(pos.api),
      fetchRemoteMenu: () => pos.api.menu.fetchMenu(pos.outletId),
      loadCachedMenu,
      persistMenuCache: cacheMenuFromApi,
      log: devLog,
    };

    await getOfflineDb();
    let cached: MenuCategory[] = [];
    try {
      cached = await loadCachedMenu(pos.outletId);
    } catch {
      const result = await refreshPosMenu(refreshParams);
      applyMenuRefreshResult(result);
      return result.menu;
    }

    if (cached.length > 0) {
      setMenuReady(true);
      setMenuBlockedMessage(null);
      void refreshPosMenu(refreshParams).then((result) => {
        applyMenuRefreshResult(result);
      });
      return cached;
    }

    const result = await refreshPosMenu(refreshParams);
    applyMenuRefreshResult(result);
    return result.menu;
  }, [applyMenuRefreshResult, devLog, pos.api, pos.outletId]);

  const refreshFloor = useCallback(async (): Promise<FloorTable[]> => {
    const params = {
      outletId: pos.outletId,
      label: "FLOOR",
      emptyValue: [] as FloorTable[],
      ensureDbReady: getOfflineDb,
      loadCache: loadCachedFloor,
      isEmpty: (rows: FloorTable[]) => rows.length === 0,
      probeReachability: () => checkApiReachability(pos.api),
      fetchRemote: async () => {
        const floor = await pos.api.outlets.getFloor(pos.outletId);
        return floor.tables ?? [];
      },
      persistCache: async (outletId: string, tables: FloorTable[]) => {
        await cacheFloorFromApi(outletId, {
          id: `cached-${outletId}`,
          name: "Cached floor",
          tables,
        });
      },
      log: devLog,
    };

    await getOfflineDb();
    let cached: FloorTable[] = [];
    try {
      cached = await loadCachedFloor(pos.outletId);
    } catch {
      const result = await refreshWithOfflineFallback(params);
      return result.data;
    }

    if (cached.length > 0) {
      void refreshWithOfflineFallback(params);
      return cached;
    }

    const result = await refreshWithOfflineFallback(params);
    return result.data;
  }, [devLog, pos.api, pos.outletId]);

  const refreshOpenOrders = useCallback(async (): Promise<OrderSummary[]> => {
    const params = {
      outletId: pos.outletId,
      label: "ORDERS",
      emptyValue: [] as OrderSummary[],
      ensureDbReady: getOfflineDb,
      loadCache: loadCachedOpenOrders,
      isEmpty: (rows: OrderSummary[]) => rows.length === 0,
      probeReachability: () => checkApiReachability(pos.api),
      fetchRemote: async () => {
        const rows = await pos.api.orders.list(pos.outletId);
        return rows
          .filter((o) => ACTIVE_ORDER_STATUSES.has(o.status))
          .sort((a, b) => {
            const ta = new Date(a.createdAt ?? 0).getTime();
            const tb = new Date(b.createdAt ?? 0).getTime();
            return tb - ta;
          });
      },
      persistCache: cacheOpenOrdersFromApi,
      log: devLog,
    };

    await getOfflineDb();
    let cached: OrderSummary[] = [];
    try {
      cached = await loadCachedOpenOrders(pos.outletId);
    } catch {
      const result = await refreshWithOfflineFallback(params);
      return result.data;
    }

    if (cached.length > 0) {
      void refreshWithOfflineFallback(params);
      return cached;
    }

    const result = await refreshWithOfflineFallback(params);
    return result.data;
  }, [devLog, pos.api, pos.outletId]);

  const triggerSync = useCallback(async () => {
    if (!pos.terminalId) return;
    await scheduleSyncWithBackoff({
      api: pos.api,
      outletId: pos.outletId,
      deviceId,
      terminalId: pos.terminalId,
      requiresOnlineLogin,
    });
    const label = await getLastSyncLabel();
    setLastSyncLabel(label);
  }, [pos.api, pos.outletId, pos.terminalId, deviceId, requiresOnlineLogin]);

  useEffect(() => {
    void getOfflineDb();
    void refreshMenu();
    void refreshFloor();
    void refreshOpenOrders();
    const unsub = subscribeSyncState((state, pending) => {
      setSyncState(state);
      setPendingCount(pending);
    });
    return unsub;
  }, [refreshMenu, refreshFloor, refreshOpenOrders]);

  const pendingCountRef = useRef(pendingCount);
  pendingCountRef.current = pendingCount;

  const applyReachability = useCallback((reachable: boolean) => {
    setApiReachable(reachable);
    setConnectivityOnline(reachable);
  }, []);

  const probeConnectivity = useCallback(async () => {
    const reachable = await probeStableApiReachability();
    applyReachability(reachable);
    return reachable;
  }, [applyReachability]);

  useEffect(() => {
    let cancelled = false;

    void probeConnectivity();
    const interval = setInterval(async () => {
      const reachable = await probeConnectivity();
      if (!cancelled && reachable && pendingCountRef.current > 0) void triggerSync();
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [probeConnectivity, triggerSync]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void probeConnectivity().then((reachable) => {
          if (reachable && pendingCount > 0) void triggerSync();
        });
      }
    });
    return () => sub.remove();
  }, [probeConnectivity, pendingCount, triggerSync]);

  const value: OfflinePosContextValue = {
    isOffline: !apiReachable,
    syncState,
    pendingCount,
    syncBlockedMessage,
    lastSyncLabel,
    menuReady,
    menuBlockedMessage,
    refreshMenu,
    refreshFloor,
    refreshOpenOrders,
    createOrder: (data) =>
      createLocalOrder(
        { ...actor, staffProfileId: actor.staffProfileId, employeeCode: actor.employeeCode },
        data,
      ),
    addItem: (orderId, item) =>
      addLocalItem({ ...actor, staffProfileId: actor.staffProfileId, employeeCode: actor.employeeCode }, orderId, item),
    fireKot: (orderId) =>
      fireLocalKot({ ...actor, staffProfileId: actor.staffProfileId, employeeCode: actor.employeeCode }, orderId),
    settle: (orderId, data) =>
      settleLocalOrder(
        { ...actor, staffProfileId: actor.staffProfileId, employeeCode: actor.employeeCode },
        orderId,
        data,
      ),
    getOrder: getLocalOrder,
    toOrderDetail: localToOrderDetail,
    triggerSync,
  };

  return <OfflinePosContext.Provider value={value}>{children}</OfflinePosContext.Provider>;
}

export function useOfflinePos() {
  const ctx = useContext(OfflinePosContext);
  if (!ctx) throw new Error("useOfflinePos must be used within OfflinePosProvider");
  return ctx;
}

export async function isLocalOrderId(orderId: string): Promise<boolean> {
  const local = await getLocalOrder(orderId);
  return local != null && !local.cloudId;
}
