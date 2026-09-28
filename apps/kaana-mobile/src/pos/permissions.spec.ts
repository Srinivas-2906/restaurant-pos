import { describe, expect, it } from "vitest";
import { resolvePosPermissions } from "./permissions";
import type { CapabilityBootstrapPayload } from "@kaana/shared-types";

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
  features: { "pos.discount": true, "procurement.purchase_orders": true } as CapabilityBootstrapPayload["features"],
  navDepth: 1,
  resolvedAt: new Date().toISOString(),
};

function fakeToken(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `h.${body}.s`;
}

const ownerPayload = {
  role: "owner",
  roles: ["owner"],
  permissions: ["access_pos", "view_reports", "apply_discount"],
};

const managerPayload = {
  role: "manager",
  roles: ["manager"],
  permissions: ["access_pos", "take_order", "settle_bill", "apply_discount"],
};

const billerPayload = {
  role: "biller",
  roles: ["biller"],
  permissions: ["take_order", "settle_bill"],
};

describe("POS permissions", () => {
  it("allows owner management context to bill", () => {
    const p = resolvePosPermissions(fakeToken(ownerPayload), caps);
    expect(p.canBill).toBe(true);
    expect(p.canSettle).toBe(true);
    expect(p.canApplyDiscount).toBe(true);
  });

  it("allows manager with take_order to bill", () => {
    const p = resolvePosPermissions(fakeToken(managerPayload), caps);
    expect(p.canBill).toBe(true);
    expect(p.canSettle).toBe(true);
  });

  it("allows operational biller context", () => {
    const p = resolvePosPermissions(fakeToken(billerPayload), caps);
    expect(p.canBill).toBe(true);
    expect(p.canFireKot).toBe(true);
  });

  it("blocks billing when POS module disabled", () => {
    const disabled = { ...caps, modules: { ...caps.modules, pos: false } };
    const p = resolvePosPermissions(fakeToken(ownerPayload), disabled);
    expect(p.canBill).toBe(false);
    expect(p.posEnabled).toBe(false);
  });

  it("hides discount without apply_discount permission", () => {
    const chefPayload = { role: "chef", roles: ["chef"], permissions: [] };
    const p = resolvePosPermissions(fakeToken(chefPayload), caps);
    expect(p.canApplyDiscount).toBe(false);
  });
});
