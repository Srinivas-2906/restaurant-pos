import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { flattenOutlets, type OutletSummary } from "@kaana/api-client";
import { useSession } from "../session/SessionProvider";
import { createMobileApi } from "../api/mobileApi";
import { secureGet, secureSet } from "../storage/secureStore";
import { useManagementAccess } from "./permissions";

const OUTLET_KEY = "kaana.mgmt.selectedOutlet";

type ManagementContextValue = {
  api: ReturnType<typeof createMobileApi>;
  outletId: string | null;
  outlets: OutletSummary[];
  outlet: OutletSummary | null;
  setOutletId: (id: string) => Promise<void>;
  loadingOutlets: boolean;
  access: ReturnType<typeof useManagementAccess>;
  refreshOutlets: () => Promise<void>;
};

const ManagementContext = createContext<ManagementContextValue | null>(null);

export function ManagementProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const { management, terminal, logoutManagement } = session;

  const [outletId, setOutletIdState] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<OutletSummary[]>([]);
  const [loadingOutlets, setLoadingOutlets] = useState(true);

  const api = useMemo(
    () =>
      createMobileApi({
        getManagementTokens: () => ({
          accessToken: management?.accessToken ?? null,
          refreshToken: management?.refreshToken ?? null,
        }),
        setManagementTokens: () => undefined,
        getTerminalCredential: () => null,
        setOperationalEmployee: () => undefined,
        clearOperationalEmployee: () => undefined,
        onManagementUnauthorized: () => {
          void logoutManagement().then(() => router.replace("/auth/login"));
        },
        onTerminalUnauthorized: () => undefined,
      }),
    [management?.accessToken, management?.refreshToken, logoutManagement, router],
  );

  const access = useManagementAccess(management?.accessToken, management?.capabilities ?? null);

  const refreshOutlets = useCallback(async () => {
    if (!management) return;
    setLoadingOutlets(true);
    try {
      const orgs = await api.organizations.list();
      const list = flattenOutlets(orgs);
      setOutlets(list);
      const saved = await secureGet(OUTLET_KEY);
      const selected = list.find((o) => o.id === saved)?.id ?? list[0]?.id ?? null;
      setOutletIdState(selected);
      if (selected) await secureSet(OUTLET_KEY, selected);
    } finally {
      setLoadingOutlets(false);
    }
  }, [api, management]);

  useEffect(() => {
    if (terminal) {
      router.replace("/operational/login");
      return;
    }
    if (!management) {
      router.replace("/entry");
      return;
    }
    void refreshOutlets();
  }, [management, terminal, refreshOutlets, router]);

  const setOutletId = useCallback(async (id: string) => {
    setOutletIdState(id);
    await secureSet(OUTLET_KEY, id);
  }, []);

  const outlet = outlets.find((o) => o.id === outletId) ?? null;

  const value = useMemo(
    () => ({
      api,
      outletId,
      outlets,
      outlet,
      setOutletId,
      loadingOutlets,
      access,
      refreshOutlets,
    }),
    [api, outletId, outlets, outlet, setOutletId, loadingOutlets, access, refreshOutlets],
  );

  return <ManagementContext.Provider value={value}>{children}</ManagementContext.Provider>;
}

export function useManagement() {
  const ctx = useContext(ManagementContext);
  if (!ctx) throw new Error("useManagement must be used within ManagementProvider");
  return ctx;
}
