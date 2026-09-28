import type { CapabilityBootstrapPayload } from "@kaana/shared-types";
import type { StoredAuthUser } from "@kaana/api-client";

export type SessionType = "none" | "management" | "operational";

export type TerminalDeviceType = "pos" | "kds" | "captain";

export type TerminalCredential = {
  terminalId: string;
  deviceSecret: string;
};

export type TerminalContext = {
  terminalId: string;
  deviceSecret: string;
  deviceType: TerminalDeviceType;
  deviceName: string;
  deviceCode: string;
  organizationId: string;
  outletId: string;
  outletName: string;
  configVersion: number;
};

export type OperationalEmployeeSession = {
  accessToken: string;
  refreshToken?: string;
  staff: {
    id: string;
    displayName: string;
    employeeCode: string;
    role: string;
    permissions?: string[];
  };
  outletId: string;
  terminalId: string;
};

export type ManagementSession = {
  accessToken: string;
  refreshToken: string;
  user: StoredAuthUser;
  capabilities: CapabilityBootstrapPayload;
};

export type BootstrapTarget =
  | { kind: "entry" }
  | { kind: "management" }
  | { kind: "operational-login" }
  | { kind: "operational-shell"; deviceType: TerminalDeviceType };

export type AppSessionState = {
  sessionType: SessionType;
  management: ManagementSession | null;
  terminal: TerminalContext | null;
  employee: OperationalEmployeeSession | null;
  bootstrapTarget: BootstrapTarget;
  revokedMessage: string | null;
  moduleUnavailable: string | null;
};

export const INITIAL_SESSION_STATE: AppSessionState = {
  sessionType: "none",
  management: null,
  terminal: null,
  employee: null,
  bootstrapTarget: { kind: "entry" },
  revokedMessage: null,
  moduleUnavailable: null,
};
