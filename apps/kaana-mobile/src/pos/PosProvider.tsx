import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "expo-router";
import type { CapabilityBootstrapPayload } from "@kaana/shared-types";
import { createOrganizationsApi, flattenOutlets } from "@kaana/api-client";
import { useSession } from "../session/SessionProvider";
import { createPosApi, type PosApi } from "./createPosApi";
import { resolvePosPermissions, resolvePosPermissionsFromList, type PosPermissions } from "./permissions";
import type { PosAuthMode } from "./types";

type PosContextValue = {
  authMode: PosAuthMode;
  api: PosApi;
  outletId: string;
  outletName: string;
  restaurantName: string;
  terminalId?: string;
  permissions: PosPermissions;
  capabilities: CapabilityBootstrapPayload | null;
  posAvailable: boolean;
  posBlockedMessage: string | null;
  loading: boolean;
  error: string | null;
  refreshCapabilities: () => Promise<void>;
  exitPos: () => void;
};

const PosContext = createContext<PosContextValue | null>(null);

type PosProviderProps = {
  children: React.ReactNode;
};

export function PosProvider({ children }: PosProviderProps) {
  const router = useRouter();
  const { management, employee, terminal, sessionType, moduleUnavailable, refreshCapabilities } =
    useSession();

  const authMode: PosAuthMode =
    employee && sessionType === "operational" ? "operational" : management ? "management" : "operational";

  const accessToken =
    authMode === "management" ? management?.accessToken ?? null : employee?.accessToken ?? null;
  const refreshToken =
    authMode === "management" ? management?.refreshToken ?? null : employee?.refreshToken ?? null;

  const [capabilities, setCapabilities] = useState<CapabilityBootstrapPayload | null>(
    management?.capabilities ?? null,
  );
  const capabilitiesRef = useRef(capabilities);
  capabilitiesRef.current = capabilities;
  const [outletId, setOutletId] = useState("");
  const [outletName, setOutletName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(() => {
    if (!accessToken) return null;
    return createPosApi({
      accessToken,
      refreshToken,
      onUnauthorized: () => {
        if (authMode === "management") router.replace("/auth/login");
        else router.replace("/operational/login");
      },
    });
  }, [accessToken, refreshToken, authMode, router]);

  const bootstrap = useCallback(async (forceCapabilities = false) => {
    if (!accessToken) {
      setError("Not signed in for POS");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const isOfflineSession = accessToken === "offline-session";

      let caps = management?.capabilities ?? capabilitiesRef.current;
      if (!isOfflineSession && api && (!caps || forceCapabilities)) {
        const res = await api.client.api<{ success: boolean; data: CapabilityBootstrapPayload }>(
          "/capabilities/me",
        );
        caps = res.data;
        setCapabilities(caps);
        capabilitiesRef.current = caps;
      }

      if (isOfflineSession) {
        setOutletId(employee?.outletId ?? terminal?.outletId ?? "");
        setOutletName(terminal?.outletName ?? "");
        setRestaurantName("Restaurant");
        setCapabilities(caps);
        setLoading(false);
        return;
      }

      if (!api) {
        setError("Not signed in for POS");
        setLoading(false);
        return;
      }

      let resolvedOutletId = employee?.outletId ?? terminal?.outletId ?? "";
      let resolvedOutletName = terminal?.outletName ?? "";
      let resolvedRestaurant = "Restaurant";

      if (authMode === "management") {
        const orgApi = createOrganizationsApi(api.client);
        const orgs = await orgApi.list();
        const outlets = flattenOutlets(orgs);
        const main = outlets.find((o) => o.code === "MAIN-001") ?? outlets[0];
        if (main) {
          resolvedOutletId = main.id;
          resolvedOutletName = main.name;
        }
        resolvedRestaurant = orgs[0]?.name ?? "Restaurant";
      }

      if (!resolvedOutletId) throw new Error("No outlet available for POS");

      setOutletId(resolvedOutletId);
      setOutletName(resolvedOutletName);
      setRestaurantName(resolvedRestaurant);
      setCapabilities(caps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize POS");
    } finally {
      setLoading(false);
    }
  }, [api, accessToken, authMode, management, employee, terminal]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const permissions = useMemo(() => {
    if (accessToken === "offline-session" && employee?.staff.permissions) {
      return resolvePosPermissionsFromList(employee.staff.permissions, employee.staff.role, capabilities);
    }
    return resolvePosPermissions(accessToken ?? "", capabilities);
  }, [accessToken, capabilities, employee]);

  const posBlockedMessage =
    moduleUnavailable ??
    (!permissions.posEnabled ? "POS is currently unavailable for this restaurant." : null);

  const posAvailable = permissions.canBill && !posBlockedMessage;

  const exitPos = useCallback(() => {
    if (authMode === "management") router.replace("/management");
    else router.replace("/pos");
  }, [authMode, router]);

  const value: PosContextValue | null =
    api && accessToken
      ? {
          authMode,
          api,
          outletId,
          outletName,
          restaurantName,
          terminalId: employee?.terminalId ?? terminal?.terminalId,
          permissions,
          capabilities,
          posAvailable,
          posBlockedMessage,
          loading,
          error,
          refreshCapabilities: async () => {
            await refreshCapabilities();
            await bootstrap(true);
          },
          exitPos,
        }
      : null;

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos must be used within PosProvider");
  return ctx;
}
