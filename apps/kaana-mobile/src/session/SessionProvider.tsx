import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import { Platform } from "react-native";
import type { CapabilityBootstrapPayload } from "@kaana/shared-types";
import { isModuleEnabled } from "@kaana/shared-types";
import { isAccessTokenExpired } from "@kaana/api-client";
import { createMobileApi } from "../api/mobileApi";
import { startTerminalHeartbeat } from "../device/heartbeat";
import { subscribeOrgRealtime } from "../realtime/configSocket";
import {
  isOperationalModuleEnabled,
  moduleLabelForDeviceType,
  resolveBootstrapTarget,
} from "../session/bootstrap";
import {
  INITIAL_SESSION_STATE,
  type AppSessionState,
  type ManagementSession,
  type OperationalEmployeeSession,
  type TerminalContext,
  type TerminalCredential,
  type TerminalDeviceType,
} from "../session/types";
import { saveStaffOfflineSnapshot, verifyOfflinePin } from "../offline/offlineAuth";
import {
  clearManagementStorage,
  clearTerminalStorage,
  loadManagementCapabilities,
  loadManagementTokens,
  loadManagementUser,
  loadTerminalContext,
  loadTerminalCredential,
  saveManagementSession,
  saveTerminalContext,
  saveTerminalCredential,
} from "../storage/sessionStore";

type SessionContextValue = AppSessionState & {
  bootstrapping: boolean;
  bootstrapError: string | null;
  retryBootstrap: () => void;
  loginManagement: (email: string, password: string) => Promise<void>;
  logoutManagement: () => Promise<void>;
  activateDevice: (code: string) => Promise<void>;
  loginEmployee: (employeeCode: string, pin: string) => Promise<void>;
  loginEmployeeOffline: (employeeCode: string, pin: string) => Promise<void>;
  logoutEmployee: () => void;
  resetDevice: () => Promise<void>;
  refreshCapabilities: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function buildDeviceMetadata() {
  return {
    appVersion: Application.nativeApplicationVersion ?? "1.0.0",
    platform: Platform.OS,
    osVersion: Device.osVersion ?? undefined,
    deviceModel: Device.modelName ?? undefined,
    deviceName: Device.deviceName ?? undefined,
  };
}

function buildDeviceId(terminalId?: string) {
  return terminalId ? `mobile:${terminalId}` : `mobile:${Device.modelId ?? "device"}`;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppSessionState>(INITIAL_SESSION_STATE);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const terminalCredentialRef = useRef<TerminalCredential | null>(null);
  const employeeRef = useRef<OperationalEmployeeSession | null>(null);
  const managementTokensRef = useRef<{ accessToken: string | null; refreshToken: string | null }>({
    accessToken: null,
    refreshToken: null,
  });
  const capabilitiesRef = useRef<CapabilityBootstrapPayload | null>(null);
  const heartbeatStopRef = useRef<(() => void) | null>(null);
  const unsubscribeRealtimeRef = useRef<(() => void) | null>(null);

  const applyBootstrapTarget = useCallback(
    (
      terminal: TerminalContext | null,
      management: ManagementSession | null,
      employee: OperationalEmployeeSession | null,
      capabilities: CapabilityBootstrapPayload | null,
      extra?: Partial<AppSessionState>,
    ) => {
      const sessionType = terminal ? "operational" : management ? "management" : "none";
      const bootstrapTarget = resolveBootstrapTarget({
        terminal,
        hasManagementSession: Boolean(management),
        employeeLoggedIn: Boolean(employee),
        capabilities,
      });
      setState({
        sessionType,
        management,
        terminal,
        employee,
        bootstrapTarget,
        revokedMessage: extra?.revokedMessage ?? null,
        moduleUnavailable: extra?.moduleUnavailable ?? null,
      });
    },
    [],
  );

  const handleRevocation = useCallback(async () => {
    heartbeatStopRef.current?.();
    heartbeatStopRef.current = null;
    unsubscribeRealtimeRef.current?.();
    unsubscribeRealtimeRef.current = null;
    terminalCredentialRef.current = null;
    employeeRef.current = null;
    await clearTerminalStorage();
    setState((prev) => ({
      ...INITIAL_SESSION_STATE,
      revokedMessage: "This device has been deactivated. Contact your restaurant administrator.",
      bootstrapTarget: { kind: "entry" },
    }));
  }, []);

  const api = useMemo(
    () =>
      createMobileApi({
        getManagementTokens: () => managementTokensRef.current,
        setManagementTokens: (accessToken, refreshToken) => {
          managementTokensRef.current = {
            accessToken,
            refreshToken: refreshToken ?? managementTokensRef.current.refreshToken,
          };
        },
        getTerminalCredential: () => terminalCredentialRef.current,
        setOperationalEmployee: (session) => {
          employeeRef.current = session;
          setState((prev) => ({ ...prev, employee: session }));
        },
        clearOperationalEmployee: () => {
          employeeRef.current = null;
          setState((prev) => ({ ...prev, employee: null }));
        },
        onManagementUnauthorized: () => {
          void (async () => {
            managementTokensRef.current = { accessToken: null, refreshToken: null };
            await clearManagementStorage();
            applyBootstrapTarget(
              terminalCredentialRef.current
                ? await loadTerminalContext()
                : null,
              null,
              employeeRef.current,
              capabilitiesRef.current,
            );
          })();
        },
        onTerminalUnauthorized: () => {
          void handleRevocation();
        },
      }),
    [applyBootstrapTarget, handleRevocation],
  );

  const startOperationalServices = useCallback(
    (terminal: TerminalContext) => {
      heartbeatStopRef.current?.();
      const metadata = buildDeviceMetadata();
      heartbeatStopRef.current = startTerminalHeartbeat(
        (payload) =>
          api.sendHeartbeat({
            ...payload,
            deviceId: buildDeviceId(terminal.terminalId),
          }),
        metadata,
      );

      unsubscribeRealtimeRef.current?.();
      if (terminal.organizationId) {
        unsubscribeRealtimeRef.current = subscribeOrgRealtime(terminal.organizationId, {
          onConfigUpdate: () => {
            void api.fetchOperationalCapabilities().then((caps) => {
              capabilitiesRef.current = caps;
              const moduleOk = isOperationalModuleEnabled(terminal.deviceType, caps);
              setState((prev) => ({
                ...prev,
                terminal: prev.terminal
                  ? { ...prev.terminal, configVersion: caps.configVersion }
                  : prev.terminal,
                moduleUnavailable: moduleOk
                  ? null
                  : `${moduleLabelForDeviceType(terminal.deviceType)} is unavailable for this restaurant.`,
              }));
            }).catch(() => undefined);
          },
          onDeviceRevoked: (payload) => {
            if (payload.terminalId === terminal.terminalId) {
              void handleRevocation();
            }
          },
        });
      }
    },
    [api, handleRevocation],
  );

  const bootstrap = useCallback(async () => {
    setBootstrapping(true);
    setBootstrapError(null);
    try {
      employeeRef.current = null;

      const storedTerminalCredential = await loadTerminalCredential();
      const storedTerminalContext = await loadTerminalContext();
      terminalCredentialRef.current = storedTerminalCredential;

      let terminal: TerminalContext | null = storedTerminalContext;
      if (storedTerminalCredential) {
        try {
          const activation = storedTerminalContext;
          if (activation) {
            terminal = activation;
          } else {
            const verified = await api.verifyTerminalCredential(storedTerminalContext);
            if (verified) {
              terminal = {
                ...verified,
                deviceSecret: storedTerminalCredential.deviceSecret,
                organizationId: verified.organizationId,
                configVersion: verified.configVersion,
              };
              await saveTerminalContext(terminal);
            } else {
              await handleRevocation();
              setBootstrapping(false);
              return;
            }
          }
          terminalCredentialRef.current = storedTerminalCredential;
          if (terminal.organizationId) {
            try {
              const caps = await api.fetchOperationalCapabilities();
              capabilitiesRef.current = caps;
              terminal = { ...terminal, configVersion: caps.configVersion };
              await saveTerminalContext(terminal);
            } catch {
              // non-fatal during bootstrap
            }
          }
          startOperationalServices(terminal);
        } catch {
          await handleRevocation();
          setBootstrapping(false);
          return;
        }
      }

      let management: ManagementSession | null = null;
      if (!storedTerminalCredential) {
        const tokens = await loadManagementTokens();
        managementTokensRef.current = tokens;
        const user = await loadManagementUser();
        const capabilities = await loadManagementCapabilities();
        capabilitiesRef.current = capabilities;

        if (tokens.accessToken && tokens.refreshToken && user) {
          if (isAccessTokenExpired(tokens.accessToken)) {
            try {
              const refreshed = await api.client.getValidAccessToken();
              if (!refreshed) throw new Error("refresh failed");
              managementTokensRef.current.accessToken = refreshed;
            } catch {
              await clearManagementStorage();
              managementTokensRef.current = { accessToken: null, refreshToken: null };
            }
          }
        }

        if (managementTokensRef.current.accessToken && user) {
          let caps = capabilities;
          try {
            caps = await api.fetchCapabilities();
            capabilitiesRef.current = caps;
          } catch {
            caps = capabilities;
          }
          management = {
            accessToken: managementTokensRef.current.accessToken!,
            refreshToken: managementTokensRef.current.refreshToken ?? "",
            user,
            capabilities: caps ?? {
              organizationId: "",
              operatingMode: "SIMPLE",
              subscriptionPlan: "LEGACY_FULL",
              configVersion: 0,
              modules: {} as CapabilityBootstrapPayload["modules"],
              features: {} as CapabilityBootstrapPayload["features"],
              navDepth: 2,
              resolvedAt: new Date().toISOString(),
            },
          };
        }
      }

      applyBootstrapTarget(terminal, management, null, capabilitiesRef.current);
    } catch (error) {
      setBootstrapError(
        error instanceof Error ? error.message : "Unable to start Kaana. Please try again.",
      );
    } finally {
      setBootstrapping(false);
    }
  }, [api, applyBootstrapTarget, handleRevocation, startOperationalServices]);

  useEffect(() => {
    void bootstrap();
    return () => {
      heartbeatStopRef.current?.();
      unsubscribeRealtimeRef.current?.();
    };
  }, [bootstrap]);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === "active" && terminalCredentialRef.current) {
        const metadata = buildDeviceMetadata();
        void api
          .sendHeartbeat({
            ...metadata,
            deviceId: buildDeviceId(terminalCredentialRef.current.terminalId),
          })
          .catch(() => undefined);
      }
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, [api]);

  const loginManagement = useCallback(
    async (email: string, password: string) => {
      if (terminalCredentialRef.current) {
        throw new Error("This device is registered as a restaurant terminal.");
      }
      const result = await api.loginManagement(email, password);
      managementTokensRef.current = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };
      capabilitiesRef.current = result.capabilities;
      const session: ManagementSession = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
        capabilities: result.capabilities,
      };
      await saveManagementSession(session);
      applyBootstrapTarget(null, session, null, result.capabilities);
    },
    [api, applyBootstrapTarget],
  );

  const logoutManagement = useCallback(async () => {
    managementTokensRef.current = { accessToken: null, refreshToken: null };
    capabilitiesRef.current = null;
    await clearManagementStorage();
    applyBootstrapTarget(
      terminalCredentialRef.current ? await loadTerminalContext() : null,
      null,
      employeeRef.current,
      null,
    );
  }, [applyBootstrapTarget]);

  const activateDevice = useCallback(
    async (code: string) => {
      const deviceId = buildDeviceId();
      const metadata = buildDeviceMetadata();
      const result = (await api.activateTerminal(code.trim(), deviceId, metadata)) as {
        terminalId: string;
        organizationId: string;
        outletId: string;
        deviceMode: TerminalDeviceType;
        deviceName: string;
        deviceCode: string;
        deviceCredential: string;
        configVersion: number;
      };

      const credential: TerminalCredential = {
        terminalId: result.terminalId,
        deviceSecret: result.deviceCredential,
      };
      const terminal: TerminalContext = {
        terminalId: result.terminalId,
        deviceSecret: result.deviceCredential,
        deviceType: result.deviceMode,
        deviceName: result.deviceName,
        deviceCode: result.deviceCode,
        organizationId: result.organizationId,
        outletId: result.outletId,
        outletName: "",
        configVersion: result.configVersion,
      };

      await saveTerminalCredential(credential);
      await saveTerminalContext(terminal);
      terminalCredentialRef.current = credential;
      employeeRef.current = null;

      try {
        const me = await api.verifyTerminalCredential();
        if (me) {
          terminal.outletName = me.outletName;
          await saveTerminalContext({ ...terminal, outletName: me.outletName });
        }
      } catch {
        // non-fatal
      }

      startOperationalServices(terminal);
      try {
        const caps = await api.fetchOperationalCapabilities();
        capabilitiesRef.current = caps;
        terminal.configVersion = caps.configVersion;
        await saveTerminalContext(terminal);
      } catch {
        // non-fatal
      }
      applyBootstrapTarget(terminal, null, null, capabilitiesRef.current);
    },
    [api, applyBootstrapTarget, startOperationalServices],
  );

  const loginEmployeeOffline = useCallback(
    async (employeeCode: string, pin: string) => {
      const terminal = terminalCredentialRef.current;
      if (!terminal) throw new Error("Terminal not activated");
      const ctx = await loadTerminalContext();
      if (!ctx) throw new Error("Terminal not activated");

      const result = await verifyOfflinePin(employeeCode, pin);
      if (!result.ok || !result.staff) {
        throw new Error(result.reason ?? "Offline login denied");
      }

      const session: OperationalEmployeeSession = {
        accessToken: "offline-session",
        staff: {
          id: result.staff.staffProfileId,
          displayName: result.staff.displayName,
          employeeCode: result.staff.employeeCode,
          role: result.staff.role,
          permissions: result.staff.permissions,
        },
        outletId: ctx.outletId,
        terminalId: ctx.terminalId,
      };
      employeeRef.current = session;
      applyBootstrapTarget(ctx, null, session, capabilitiesRef.current);
    },
    [applyBootstrapTarget],
  );

  const loginEmployee = useCallback(
    async (employeeCode: string, pin: string) => {
      const terminal = terminalCredentialRef.current;
      if (!terminal) throw new Error("Terminal not activated");

      const session = await api.pinLoginByEmployeeCode(employeeCode, pin);
      if (session.offlineAuth) {
        await saveStaffOfflineSnapshot(session.offlineAuth, pin);
      }
      employeeRef.current = session;
      applyBootstrapTarget(
        await loadTerminalContext(),
        null,
        session,
        capabilitiesRef.current,
      );
    },
    [api, applyBootstrapTarget],
  );

  const logoutEmployee = useCallback(() => {
    employeeRef.current = null;
    setState((prev) => ({
      ...prev,
      employee: null,
      bootstrapTarget: prev.terminal
        ? { kind: "operational-login" }
        : { kind: "entry" },
    }));
  }, []);

  const resetDevice = useCallback(async () => {
    heartbeatStopRef.current?.();
    heartbeatStopRef.current = null;
    unsubscribeRealtimeRef.current?.();
    unsubscribeRealtimeRef.current = null;
    terminalCredentialRef.current = null;
    employeeRef.current = null;
    await clearTerminalStorage();
    applyBootstrapTarget(null, state.management, null, capabilitiesRef.current, {
      revokedMessage: null,
    });
  }, [applyBootstrapTarget, state.management]);

  const refreshCapabilities = useCallback(async () => {
    if (state.sessionType === "management" && managementTokensRef.current.accessToken) {
      const caps = await api.fetchCapabilities();
      capabilitiesRef.current = caps;
      if (state.management) {
        const updated = { ...state.management, capabilities: caps };
        await saveManagementSession(updated);
        setState((prev) => ({ ...prev, management: updated }));
      }
    }
    if (state.terminal) {
      const moduleOk = isOperationalModuleEnabled(
        state.terminal.deviceType,
        capabilitiesRef.current,
      );
      setState((prev) => ({
        ...prev,
        moduleUnavailable: moduleOk
          ? null
          : `${moduleLabelForDeviceType(state.terminal!.deviceType)} is unavailable for this restaurant.`,
      }));
    }
  }, [api, state.management, state.sessionType, state.terminal]);

  const value = useMemo<SessionContextValue>(
    () => ({
      ...state,
      bootstrapping,
      bootstrapError,
      retryBootstrap: () => void bootstrap(),
      loginManagement,
      logoutManagement,
      activateDevice,
      loginEmployee,
      loginEmployeeOffline,
      logoutEmployee,
      resetDevice,
      refreshCapabilities,
    }),
    [
      state,
      bootstrapping,
      bootstrapError,
      bootstrap,
      loginManagement,
      logoutManagement,
      activateDevice,
      loginEmployee,
      loginEmployeeOffline,
      logoutEmployee,
      resetDevice,
      refreshCapabilities,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

export function useCapabilities() {
  const { management, terminal, sessionType } = useSession();
  const capabilities = management?.capabilities ?? null;
  return {
    capabilities,
    hasModule: (key: keyof CapabilityBootstrapPayload["modules"]) =>
      capabilities ? isModuleEnabled(capabilities, key) : false,
    organizationId: management?.capabilities.organizationId ?? terminal?.organizationId ?? null,
    sessionType,
  };
}
