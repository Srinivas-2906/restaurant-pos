import {
  createApiClient,
  createAuthApi,
  createCapabilitiesApi,
  createDevicesApi,
  createInventoryApi,
  createOrdersApi,
  createOrganizationsApi,
  createReportsApi,
  createStaffApi,
  createAccountingApi,
  type EligibleStaffMember,
  type StoredAuthUser,
} from "@kaana/api-client";
import type { CapabilityBootstrapPayload } from "@kaana/shared-types";
import { API_URL } from "../config/env";
import type {
  OperationalEmployeeSession,
  TerminalContext,
  TerminalCredential,
} from "../session/types";
import {
  OperationalAccessDeniedError,
  OperationalNetworkError,
} from "./operationalLoginErrors";

export type MobileApiCallbacks = {
  onManagementUnauthorized: () => void;
  onTerminalUnauthorized: () => void;
  setManagementTokens: (accessToken: string, refreshToken?: string) => void;
  getManagementTokens: () => { accessToken: string | null; refreshToken: string | null };
  getTerminalCredential: () => TerminalCredential | null;
  setOperationalEmployee: (session: OperationalEmployeeSession | null) => void;
  clearOperationalEmployee: () => void;
};

export function createMobileApi(callbacks: MobileApiCallbacks) {
  let managementAccessToken = callbacks.getManagementTokens().accessToken;
  let managementRefreshToken = callbacks.getManagementTokens().refreshToken;

  const client = createApiClient({
    apiUrl: API_URL,
    getToken: () => managementAccessToken,
    getRefreshToken: () => managementRefreshToken,
    setToken: (token) => {
      managementAccessToken = token;
      callbacks.setManagementTokens(token);
    },
    onUnauthorized: () => callbacks.onManagementUnauthorized(),
  });

  const auth = createAuthApi(client, {
    setSession: (data) => {
      managementAccessToken = data.accessToken;
      managementRefreshToken = data.refreshToken;
      callbacks.setManagementTokens(data.accessToken, data.refreshToken);
    },
    clearOperationalSession: () => callbacks.clearOperationalEmployee(),
  });

  const capabilities = createCapabilitiesApi(client);
  const devices = createDevicesApi(client);
  const orders = createOrdersApi(client);
  const reports = createReportsApi(client);
  const organizations = createOrganizationsApi(client);
  const inventory = createInventoryApi(client);
  const staff = createStaffApi(client);
  const accounting = createAccountingApi(client);

  async function terminalFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const credential = callbacks.getTerminalCredential();
    if (!credential) {
      throw new Error("Terminal not registered on this device");
    }

    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Terminal ${credential.terminalId}:${credential.deviceSecret}`,
          ...init.headers,
        },
      });
    } catch {
      throw new OperationalNetworkError();
    }

    if (res.status === 401) {
      callbacks.onTerminalUnauthorized();
      throw new Error("Terminal credential invalid or revoked");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const message = err.message || err.error || "Request failed";
      if (res.status === 403 && path.includes("pin-login")) {
        throw new OperationalAccessDeniedError(message);
      }
      throw new Error(message);
    }

    return res.json() as Promise<T>;
  }

  return {
    client,
    auth,
    capabilities,
    devices,
    orders,
    reports,
    organizations,
    inventory,
    staff,
    accounting,
    terminalFetch,
    async loginManagement(email: string, password: string) {
      const data = await auth.login(email, password);
      const caps = await capabilities.fetchMe();
      return { ...data, capabilities: caps };
    },
    async fetchCapabilities(): Promise<CapabilityBootstrapPayload> {
      return capabilities.fetchMe();
    },
    async activateTerminal(
      code: string,
      deviceId: string,
      deviceMetadata: Record<string, unknown>,
    ) {
      return devices.redeemTerminalActivationCode(code, deviceId, deviceMetadata);
    },
    async sendHeartbeat(payload: {
      deviceId?: string;
      appVersion?: string;
      platform?: string;
      osVersion?: string;
    }) {
      return devices.terminalHeartbeat(payload);
    },
    async fetchEligibleStaff() {
      return terminalFetch<EligibleStaffMember[]>("/operational/terminals/me/eligible-staff");
    },
    async pinLoginByEmployeeCode(employeeCode: string, pin: string) {
      const normalized = employeeCode.trim().toUpperCase();
      const eligible = await terminalFetch<EligibleStaffMember[]>(
        "/operational/terminals/me/eligible-staff",
      );
      const staff = eligible.find(
        (member) => member.employeeCode.trim().toUpperCase() === normalized,
      );
      if (!staff) {
        throw new OperationalAccessDeniedError();
      }
      const data = await terminalFetch<{
        accessToken: string;
        refreshToken?: string;
        staff: {
          id: string;
          displayName: string;
          employeeCode: string;
          role: string;
          permissions?: string[];
        };
        offlineAuth?: {
          staffProfileId: string;
          employeeCode: string;
          displayName: string;
          role: string;
          permissions: string[];
          offlineAuthValidUntil: string;
          verifiedAt: string;
        };
        outletId: string;
        terminalId: string;
      }>("/operational/pin-login", {
        method: "POST",
        body: JSON.stringify({ staffProfileId: staff.id, pin }),
      });
      callbacks.setOperationalEmployee({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        staff: {
          ...data.staff,
          permissions: data.staff.permissions ?? data.offlineAuth?.permissions ?? [],
        },
        outletId: data.outletId,
        terminalId: data.terminalId,
      });
      return { ...data, pinForOffline: pin };
    },
    async verifyTerminalCredential(stored?: TerminalContext | null): Promise<TerminalContext | null> {
      const credential = callbacks.getTerminalCredential();
      if (!credential) return null;
      try {
        const me = await terminalFetch<{
          id: string;
          name: string;
          code: string;
          deviceType: "pos" | "kds" | "captain";
          outlet: { id: string; name: string; code: string };
        }>("/operational/terminals/me");
        return {
          terminalId: me.id,
          deviceSecret: credential.deviceSecret,
          deviceType: me.deviceType,
          deviceName: me.name,
          deviceCode: me.code,
          organizationId: stored?.organizationId ?? "",
          outletId: me.outlet.id,
          outletName: me.outlet.name,
          configVersion: stored?.configVersion ?? 0,
        };
      } catch {
        return null;
      }
    },
    async fetchOperationalCapabilities(): Promise<CapabilityBootstrapPayload> {
      return terminalFetch<CapabilityBootstrapPayload>("/operational/terminals/me/capabilities");
    },
  };
}

export type MobileApi = ReturnType<typeof createMobileApi>;
