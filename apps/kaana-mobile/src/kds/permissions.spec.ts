import { describe, expect, it } from "vitest";
import type { KdsQueueKot } from "@kaana/api-client";
import type { CapabilityBootstrapPayload } from "@kaana/shared-types";
import {
  columnForKotStatus,
  isOrderFullyReady,
  isOrderPartialReady,
  orderContextLabel,
  partitionKotsByColumn,
  resolveKdsPermissions,
} from "./permissions";

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

function kot(status: string, id = "k1"): KdsQueueKot {
  return {
    id,
    kotNumber: "KOT-0001",
    status,
    firedAt: new Date().toISOString(),
    kitchenStation: { id: "s1", name: "Main Kitchen", code: "MAIN" },
    order: { id: "o1", orderNumber: "ORD-1", type: "dine_in", table: { id: "t1", number: "2" } },
    items: [{ id: "i1", quantity: 1, status, orderItem: { id: "oi1", name: "Chicken Biryani", notes: "Less spicy" } }],
  };
}

describe("kds permissions", () => {
  it("allows chef on kds device", () => {
    const p = resolveKdsPermissions(
      token({ role: "chef", roles: ["chef"], permissions: ["access_kds", "manage_kot"] }),
      caps,
    );
    expect(p.canAccessKds).toBe(true);
    expect(p.canBumpTickets).toBe(true);
  });

  it("denies cashier on kds device", () => {
    const p = resolveKdsPermissions(
      token({ role: "biller", roles: ["biller"], permissions: ["access_pos", "take_payment"] }),
      caps,
    );
    expect(p.canAccessKds).toBe(false);
  });

  it("allows multi-role EMP004 pattern", () => {
    const p = resolveKdsPermissions(
      token({
        role: "chef",
        roles: ["biller", "captain", "chef"],
        permissions: ["access_kds", "manage_kot", "access_pos", "access_captain"],
      }),
      caps,
    );
    expect(p.canAccessKds).toBe(true);
  });

  it("blocks when kds module disabled", () => {
    const disabled = { ...caps, modules: { ...caps.modules, kds: false } };
    const p = resolveKdsPermissions(
      token({ role: "chef", roles: ["chef"], permissions: ["access_kds", "manage_kot"] }),
      disabled,
    );
    expect(p.kdsEnabled).toBe(false);
    expect(p.canAccessKds).toBe(false);
  });
});

describe("kds queue mapping", () => {
  it("maps statuses to columns", () => {
    expect(columnForKotStatus("pending")).toBe("new");
    expect(columnForKotStatus("preparing")).toBe("preparing");
    expect(columnForKotStatus("ready")).toBe("ready");
  });

  it("partitions kots by column", () => {
    const parts = partitionKotsByColumn([
      kot("pending", "a"),
      kot("preparing", "b"),
      kot("ready", "c"),
    ]);
    expect(parts.new).toHaveLength(1);
    expect(parts.preparing).toHaveLength(1);
    expect(parts.ready).toHaveLength(1);
  });

  it("detects partial ready multi-kot orders", () => {
    expect(isOrderPartialReady([kot("ready", "a"), kot("preparing", "b")])).toBe(true);
    expect(isOrderFullyReady([kot("ready", "a"), kot("ready", "b")])).toBe(true);
    expect(isOrderFullyReady([kot("ready", "a"), kot("preparing", "b")])).toBe(false);
  });

  it("formats order context label", () => {
    expect(orderContextLabel(kot("pending"))).toBe("TABLE 2");
    const takeaway = {
      ...kot("pending"),
      order: { ...kot("pending").order, table: null, type: "takeaway" },
    };
    expect(orderContextLabel(takeaway)).toBe("TAKEAWAY");
  });
});
