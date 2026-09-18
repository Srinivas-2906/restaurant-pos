import type { CapabilityBootstrapPayload } from "@kaana/shared-types";
import type { BootstrapTarget, TerminalContext, TerminalDeviceType } from "./types";

const MODULE_FOR_DEVICE: Record<TerminalDeviceType, keyof CapabilityBootstrapPayload["modules"]> = {
  pos: "pos",
  kds: "kds",
  captain: "captain",
};

/**
 * Dual-state policy (Step 6 MVP):
 * - Activated operational terminal always takes precedence over management session.
 * - Management login is only offered when no terminal credential is stored.
 * - One install behaves as either a restaurant device OR a personal management device.
 */
export function resolveBootstrapTarget(input: {
  terminal: TerminalContext | null;
  hasManagementSession: boolean;
  employeeLoggedIn: boolean;
  capabilities: CapabilityBootstrapPayload | null;
}): BootstrapTarget {
  if (input.terminal) {
    const moduleKey = MODULE_FOR_DEVICE[input.terminal.deviceType];
    if (input.capabilities && input.capabilities.modules[moduleKey] === false) {
      return { kind: "operational-login" };
    }
    if (input.employeeLoggedIn) {
      return { kind: "operational-shell", deviceType: input.terminal.deviceType };
    }
    return { kind: "operational-login" };
  }

  if (input.hasManagementSession) {
    return { kind: "management" };
  }

  return { kind: "entry" };
}

export function shellPathForDeviceType(deviceType: TerminalDeviceType): string {
  switch (deviceType) {
    case "kds":
      return "/kds";
    case "captain":
      return "/captain";
    case "pos":
    default:
      return "/pos";
  }
}

export function moduleLabelForDeviceType(deviceType: TerminalDeviceType): string {
  switch (deviceType) {
    case "kds":
      return "KDS";
    case "captain":
      return "Captain";
    case "pos":
    default:
      return "POS";
  }
}

export function isOperationalModuleEnabled(
  deviceType: TerminalDeviceType,
  capabilities: CapabilityBootstrapPayload | null,
): boolean {
  if (!capabilities) return true;
  return capabilities.modules[MODULE_FOR_DEVICE[deviceType]] !== false;
}
