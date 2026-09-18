import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import type { CapabilityBootstrapPayload } from "@kaana/shared-types";
import { useSession } from "../session/SessionProvider";
import { createOperationalApi, type OperationalApi } from "../operational/createOperationalApi";
import { resolveCaptainPermissions, type CaptainPermissions } from "./permissions";

type CaptainContextValue = {
  api: OperationalApi;
  outletId: string;
  outletName: string;
  terminalId: string;
  employeeName: string;
  permissions: CaptainPermissions;
  capabilities: CapabilityBootstrapPayload | null;
  captainAvailable: boolean;
  captainBlockedMessage: string | null;
  loading: boolean;
  error: string | null;
  refreshCapabilities: () => Promise<void>;
};

const CaptainContext = createContext<CaptainContextValue | null>(null);

export function CaptainProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { employee, terminal, moduleUnavailable, refreshCapabilities } = useSession();

  const accessToken = employee?.accessToken ?? null;
  const refreshToken = employee?.refreshToken ?? null;
  const outletId = employee?.outletId ?? terminal?.outletId ?? "";
  const outletName = terminal?.outletName ?? "";
  const terminalId = employee?.terminalId ?? terminal?.terminalId ?? "";

  const [capabilities, setCapabilities] = useState<CapabilityBootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(() => {
    if (!accessToken) return null;
    return createOperationalApi({
      accessToken,
      refreshToken,
      onUnauthorized: () => router.replace("/operational/login"),
    });
  }, [accessToken, refreshToken, router]);

  const bootstrap = useCallback(async () => {
    if (!api || !accessToken || !outletId) {
      setError("Captain session not ready");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.client.api<{ success: boolean; data: CapabilityBootstrapPayload }>(
        "/capabilities/me",
      );
      setCapabilities(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Captain capabilities");
    } finally {
      setLoading(false);
    }
  }, [api, accessToken, outletId]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const permissions = useMemo(
    () => resolveCaptainPermissions(accessToken ?? "", capabilities),
    [accessToken, capabilities],
  );

  const captainBlockedMessage =
    moduleUnavailable ??
    (!permissions.captainEnabled ? "Captain is currently unavailable for this restaurant." : null);

  const captainAvailable = permissions.canTakeOrders && !captainBlockedMessage;

  if (!api || !accessToken) return null;

  const value: CaptainContextValue = {
    api,
    outletId,
    outletName,
    terminalId,
    employeeName: employee?.staff.displayName ?? "Captain",
    permissions,
    capabilities,
    captainAvailable,
    captainBlockedMessage,
    loading,
    error,
    refreshCapabilities: async () => {
      await refreshCapabilities();
      await bootstrap();
    },
  };

  return <CaptainContext.Provider value={value}>{children}</CaptainContext.Provider>;
}

export function useCaptain() {
  const ctx = useContext(CaptainContext);
  if (!ctx) throw new Error("useCaptain must be used within CaptainProvider");
  return ctx;
}
