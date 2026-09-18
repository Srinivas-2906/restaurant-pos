import { describe, expect, it } from "vitest";
import { resolveCaptainPermissions } from "./permissions";
import type { CapabilityBootstrapPayload } from "@kaana/shared-types";
import { deriveTablePhase, collectReadyTables } from "./tablePhase";
import type { FloorTable } from "@kaana/api-client";

const caps: CapabilityBootstrapPayload = {
  organizationId: "org1",
  operatingMode: "SIMPLE",
  subscriptionPlan: "LEGACY_FULL",
  configVersion: 1,
  modules: {
    pos: true,
    kds: true,
    captain: true,
    inventory: true,
    finance: true,
    reports: true,
    devices: true,
    procurement: true,
    payroll: true,
    crm: true,
    reservations: true,
    developer: true,
  },
  features: {} as CapabilityBootstrapPayload["features"],
  navDepth: 1,
  resolvedAt: new Date().toISOString(),
};

function token(payload: object) {
  return `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
}

describe("captain permissions", () => {
  it("allows captain employee on captain device", () => {
    const p = resolveCaptainPermissions(
      token({ role: "captain", roles: ["captain"], permissions: ["access_captain", "take_order", "manage_kot", "request_bill"] }),
      caps,
    );
    expect(p.canTakeOrders).toBe(true);
    expect(p.canFireKot).toBe(true);
    expect(p.canRequestBill).toBe(true);
    expect(p.canApplyDiscount).toBe(false);
  });

  it("denies chef on captain device", () => {
    const p = resolveCaptainPermissions(
      token({ role: "chef", roles: ["chef"], permissions: ["access_kds"] }),
      caps,
    );
    expect(p.canTakeOrders).toBe(false);
  });

  it("allows multi-role floor manager", () => {
    const p = resolveCaptainPermissions(
      token({
        role: "biller",
        roles: ["biller", "captain"],
        permissions: ["access_captain", "take_order", "manage_kot"],
      }),
      caps,
    );
    expect(p.canTakeOrders).toBe(true);
  });

  it("blocks when captain module disabled", () => {
    const disabled = { ...caps, modules: { ...caps.modules, captain: false } };
    const p = resolveCaptainPermissions(
      token({ role: "captain", roles: ["captain"], permissions: ["access_captain", "take_order"] }),
      disabled,
    );
    expect(p.canTakeOrders).toBe(false);
  });
});

describe("table phase", () => {
  it("maps free table", () => {
    expect(deriveTablePhase({ id: "1", number: "1", status: "free", capacity: 4 })).toBe("free");
  });

  it("maps ready table from active order", () => {
    const table: FloorTable = {
      id: "2",
      number: "2",
      status: "seated",
      capacity: 4,
      activeOrder: {
        id: "o1",
        orderNumber: "ORD-1",
        status: "ready",
        totalAmount: 500,
        itemCount: 2,
        itemQty: 2,
        pendingKot: 0,
        inKitchen: 0,
        readyCount: 2,
        kotCount: 1,
        createdAt: new Date().toISOString(),
        elapsedMins: 5,
      },
    };
    expect(deriveTablePhase(table)).toBe("ready");
    expect(collectReadyTables([table])).toHaveLength(1);
  });
});
