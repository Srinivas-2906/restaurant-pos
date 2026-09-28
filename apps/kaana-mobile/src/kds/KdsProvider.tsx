import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import type { KdsQueueKot } from "@kaana/api-client";
import type { CapabilityBootstrapPayload } from "@kaana/shared-types";
import { useSession } from "../session/SessionProvider";
import { createOperationalApi, type OperationalApi } from "../operational/createOperationalApi";
import { resolveKdsPermissions, type KdsPermissions } from "./permissions";
import { useKdsRealtime } from "./useKdsRealtime";

type KdsContextValue = {
  api: OperationalApi;
  outletId: string;
  outletName: string;
  terminalId: string;
  employeeName: string;
  permissions: KdsPermissions;
  capabilities: CapabilityBootstrapPayload | null;
  kdsAvailable: boolean;
  kdsBlockedMessage: string | null;
  kots: KdsQueueKot[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  bumpingId: string | null;
  connectionStatus: "online" | "reconnecting" | "offline";
  loadQueue: () => Promise<void>;
  startPreparing: (kotId: string) => Promise<void>;
  markReady: (kotId: string) => Promise<void>;
  refreshCapabilities: () => Promise<void>;
};

const KdsContext = createContext<KdsContextValue | null>(null);

export function KdsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { employee, terminal, moduleUnavailable, refreshCapabilities } = useSession();

  const accessToken = employee?.accessToken ?? null;
  const refreshToken = employee?.refreshToken ?? null;
  const outletId = employee?.outletId ?? terminal?.outletId ?? "";
  const outletName = terminal?.outletName ?? "";
  const terminalId = employee?.terminalId ?? terminal?.terminalId ?? "";

  const [capabilities, setCapabilities] = useState<CapabilityBootstrapPayload | null>(null);
  const [kots, setKots] = useState<KdsQueueKot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bumpingId, setBumpingId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"online" | "reconnecting" | "offline">("offline");

  const api = useMemo(() => {
    if (!accessToken) return null;
    return createOperationalApi({
      accessToken,
      refreshToken,
      onUnauthorized: () => router.replace("/operational/login"),
    });
  }, [accessToken, refreshToken, router]);

  const bootstrapCaps = useCallback(async () => {
    if (!api || !accessToken) return;
    try {
      const res = await api.client.api<{ success: boolean; data: CapabilityBootstrapPayload }>(
        "/capabilities/me",
      );
      setCapabilities(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load KDS capabilities");
    }
  }, [api, accessToken]);

  const loadQueue = useCallback(async () => {
    if (!api || !outletId) return;
    setError(null);
    try {
      const data = await api.kds.getOutletQueue(outletId);
      setKots(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load kitchen queue");
    }
  }, [api, outletId]);

  useEffect(() => {
    void bootstrapCaps();
  }, [bootstrapCaps]);

  useEffect(() => {
    if (!api || !outletId) return;
    setLoading(true);
    void loadQueue().finally(() => setLoading(false));
  }, [api, outletId, loadQueue]);

  useKdsRealtime(outletId, (event) => {
    if (event.type === "socket_connected") setConnectionStatus("online");
    else if (event.type === "socket_disconnected") setConnectionStatus("reconnecting");
    else if (event.type) void loadQueue();
  });

  const permissions = useMemo(
    () => resolveKdsPermissions(accessToken ?? "", capabilities),
    [accessToken, capabilities],
  );

  const kdsBlockedMessage =
    moduleUnavailable ??
    (!permissions.kdsEnabled ? "KDS is currently unavailable for this restaurant." : null);

  const kdsAvailable = permissions.canAccessKds && permissions.canBumpTickets && !kdsBlockedMessage;

  async function mutateKot(kotId: string, action: "preparing" | "ready") {
    if (!api || !kdsAvailable) return;
    setBumpingId(kotId);
    setError(null);
    try {
      if (action === "preparing") await api.kds.markPreparing(kotId);
      else await api.kds.markReady(kotId);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update ticket");
      await loadQueue();
    } finally {
      setBumpingId(null);
    }
  }

  if (!api || !accessToken) return null;

  const value: KdsContextValue = {
    api,
    outletId,
    outletName,
    terminalId,
    employeeName: employee?.staff.displayName ?? "Chef",
    permissions,
    capabilities,
    kdsAvailable,
    kdsBlockedMessage,
    kots,
    loading,
    refreshing,
    error,
    bumpingId,
    connectionStatus,
    loadQueue: async () => {
      setRefreshing(true);
      await loadQueue();
      setRefreshing(false);
    },
    startPreparing: (kotId) => mutateKot(kotId, "preparing"),
    markReady: (kotId) => mutateKot(kotId, "ready"),
    refreshCapabilities: async () => {
      await refreshCapabilities();
      await bootstrapCaps();
      await loadQueue();
    },
  };

  return <KdsContext.Provider value={value}>{children}</KdsContext.Provider>;
}

export function useKds() {
  const ctx = useContext(KdsContext);
  if (!ctx) throw new Error("useKds must be used within KdsProvider");
  return ctx;
}
