import { describe, expect, it } from "vitest";
import { filterNavItems, MORE_ITEMS, TAB_ITEMS } from "./navigation";
import { useManagementAccess } from "./permissions";
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
  features: {
    "procurement.purchase_orders": true,
  } as CapabilityBootstrapPayload["features"],
  navDepth: 2,
  resolvedAt: new Date().toISOString(),
};

const ownerTokenPayload = {
  sub: "u1",
  authMode: "email",
  role: "owner",
  roles: ["owner"],
  permissions: ["access_operations", "access_pos", "view_reports"],
};

function fakeToken(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `h.${body}.s`;
}

describe("management navigation", () => {
  it("shows home tabs for enabled capabilities", () => {
    const access = useManagementAccess(fakeToken(ownerTokenPayload), caps);
    const tabs = filterNavItems(TAB_ITEMS, access);
    expect(tabs.some((t) => t.id === "inventory")).toBe(true);
    expect(tabs.some((t) => t.id === "orders")).toBe(true);
  });

  it("hides inventory when module disabled", () => {
    const disabled = {
      ...caps,
      modules: { ...caps.modules, inventory: false },
    };
    const access = useManagementAccess(fakeToken(ownerTokenPayload), disabled);
    const tabs = filterNavItems(TAB_ITEMS, access);
    expect(tabs.some((t) => t.id === "inventory")).toBe(false);
  });

  it("shows expenses to manager with finance and view_reports", () => {
    const managerAccess = useManagementAccess(
      fakeToken({ ...ownerTokenPayload, role: "manager", roles: ["manager"] }),
      caps,
    );
    const more = filterNavItems(MORE_ITEMS, managerAccess);
    expect(more.some((m) => m.id === "expenses")).toBe(true);
    expect(more.some((m) => m.id === "staff")).toBe(true);
  });

  it("hides expenses when finance module disabled", () => {
    const noFinance = {
      ...caps,
      modules: { ...caps.modules, finance: false },
    };
    const managerAccess = useManagementAccess(
      fakeToken({ ...ownerTokenPayload, role: "manager", roles: ["manager"] }),
      noFinance,
    );
    const more = filterNavItems(MORE_ITEMS, managerAccess);
    expect(more.some((m) => m.id === "expenses")).toBe(false);
  });

  it("keeps SIMPLE enabled modules visible", () => {
    const access = useManagementAccess(fakeToken(ownerTokenPayload), { ...caps, operatingMode: "SIMPLE" });
    const more = filterNavItems(MORE_ITEMS, access);
    expect(more.map((m) => m.id)).toEqual(expect.arrayContaining(["sales", "reports", "purchases"]));
  });
});
