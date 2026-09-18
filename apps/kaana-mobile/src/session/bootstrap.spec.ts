import { describe, expect, it } from "vitest";
import {
  isOperationalModuleEnabled,
  resolveBootstrapTarget,
  shellPathForDeviceType,
} from "./bootstrap";
import type { TerminalContext } from "./types";

const terminal = (deviceType: "pos" | "kds" | "captain"): TerminalContext => ({
  terminalId: "t1",
  deviceSecret: "secret",
  deviceType,
  deviceName: "Test",
  deviceCode: "POS-1",
  organizationId: "org1",
  outletId: "out1",
  outletName: "Main",
  configVersion: 1,
});

describe("resolveBootstrapTarget", () => {
  it("routes to entry when no session", () => {
    expect(resolveBootstrapTarget({
      terminal: null,
      hasManagementSession: false,
      employeeLoggedIn: false,
      capabilities: null,
    })).toEqual({ kind: "entry" });
  });

  it("routes to management when owner session without terminal", () => {
    expect(resolveBootstrapTarget({
      terminal: null,
      hasManagementSession: true,
      employeeLoggedIn: false,
      capabilities: null,
    })).toEqual({ kind: "management" });
  });

  it("operational terminal takes precedence over management session", () => {
    expect(resolveBootstrapTarget({
      terminal: terminal("pos"),
      hasManagementSession: true,
      employeeLoggedIn: false,
      capabilities: null,
    })).toEqual({ kind: "operational-login" });
  });

  it("routes activated POS to employee login before PIN", () => {
    expect(resolveBootstrapTarget({
      terminal: terminal("pos"),
      hasManagementSession: false,
      employeeLoggedIn: false,
      capabilities: null,
    })).toEqual({ kind: "operational-login" });
  });

  it("routes POS employee to POS shell", () => {
    expect(resolveBootstrapTarget({
      terminal: terminal("pos"),
      hasManagementSession: false,
      employeeLoggedIn: true,
      capabilities: null,
    })).toEqual({ kind: "operational-shell", deviceType: "pos" });
  });

  it("routes KDS employee to KDS shell", () => {
    expect(resolveBootstrapTarget({
      terminal: terminal("kds"),
      hasManagementSession: false,
      employeeLoggedIn: true,
      capabilities: null,
    })).toEqual({ kind: "operational-shell", deviceType: "kds" });
  });

  it("routes Captain employee to Captain shell", () => {
    expect(resolveBootstrapTarget({
      terminal: terminal("captain"),
      hasManagementSession: false,
      employeeLoggedIn: true,
      capabilities: null,
    })).toEqual({ kind: "operational-shell", deviceType: "captain" });
  });

  it("multi-role employee follows device mode not role", () => {
    expect(shellPathForDeviceType("kds")).toBe("/kds");
    expect(shellPathForDeviceType("captain")).toBe("/captain");
    expect(shellPathForDeviceType("pos")).toBe("/pos");
  });
});

describe("isOperationalModuleEnabled", () => {
  it("blocks when module disabled", () => {
    expect(
      isOperationalModuleEnabled("kds", {
        organizationId: "org",
        operatingMode: "SIMPLE",
        subscriptionPlan: "LEGACY_FULL",
        configVersion: 1,
        modules: { pos: true, kds: false, captain: true } as never,
        features: {} as never,
        navDepth: 2,
        resolvedAt: new Date().toISOString(),
      }),
    ).toBe(false);
  });
});

describe("dual-state policy", () => {
  it("employee logout retains terminal activation target", () => {
    expect(resolveBootstrapTarget({
      terminal: terminal("pos"),
      hasManagementSession: false,
      employeeLoggedIn: false,
      capabilities: null,
    })).toEqual({ kind: "operational-login" });
  });

  it("management logout without terminal returns to entry", () => {
    expect(resolveBootstrapTarget({
      terminal: null,
      hasManagementSession: false,
      employeeLoggedIn: false,
      capabilities: null,
    })).toEqual({ kind: "entry" });
  });
});
