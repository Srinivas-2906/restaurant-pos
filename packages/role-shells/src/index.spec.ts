import {
  getNavForRolesWithCapabilities,
  resolveOperationsRouteAccess,
  type CapabilityNavContext,
} from "./index";

const ALL_ENABLED: CapabilityNavContext = {
  modules: {
    pos: true,
    kds: true,
    captain: true,
    inventory: true,
    procurement: true,
    payroll: true,
    finance: true,
    crm: true,
    reservations: true,
    reports: true,
    devices: true,
    developer: true,
  },
  features: {
    "inventory.stock_transfer": true,
  },
  navDepth: 1,
};

describe("getNavForRolesWithCapabilities", () => {
  it("shows inventory for owner when module enabled in SIMPLE mode", () => {
    const nav = getNavForRolesWithCapabilities(["owner"], ALL_ENABLED);
    expect(nav.some((item) => item.id === "pos_store")).toBe(true);
    expect(nav.some((item) => item.id === "finance")).toBe(true);
  });

  it("hides disabled module nav for owner", () => {
    const nav = getNavForRolesWithCapabilities(["owner"], {
      ...ALL_ENABLED,
      modules: { ...ALL_ENABLED.modules, inventory: false },
    });
    expect(nav.some((item) => item.id === "pos_store")).toBe(false);
  });

  it("hides finance for manager even when enabled", () => {
    const nav = getNavForRolesWithCapabilities(["manager"], ALL_ENABLED);
    expect(nav.some((item) => item.id === "finance")).toBe(false);
    expect(nav.some((item) => item.id === "payroll")).toBe(false);
  });

  it("hides support/outlets in SIMPLE presentation depth", () => {
    const nav = getNavForRolesWithCapabilities(["owner"], { ...ALL_ENABLED, navDepth: 1 });
    expect(nav.some((item) => item.id === "support")).toBe(false);
    expect(nav.some((item) => item.id === "outlets")).toBe(false);
    expect(nav.some((item) => item.id === "inventory" || item.id === "pos_store")).toBe(true);
  });

  it("shows support/outlets at ADVANCED depth", () => {
    const nav = getNavForRolesWithCapabilities(["owner"], { ...ALL_ENABLED, navDepth: 3 });
    expect(nav.some((item) => item.id === "support")).toBe(true);
    expect(nav.some((item) => item.id === "outlets")).toBe(true);
  });
});

describe("resolveOperationsRouteAccess", () => {
  it("allows enabled module route for owner", () => {
    const result = resolveOperationsRouteAccess("/inventory", ["owner"], ALL_ENABLED);
    expect(result.allowed).toBe(true);
  });

  it("blocks disabled module route for owner", () => {
    const result = resolveOperationsRouteAccess("/inventory", ["owner"], {
      ...ALL_ENABLED,
      modules: { ...ALL_ENABLED.modules, inventory: false },
    });
    expect(result.allowed).toBe(false);
    expect(result.blockedReason).toBe("module");
  });

  it("blocks enabled module route for manager without role access to finance", () => {
    const result = resolveOperationsRouteAccess("/finance", ["manager"], ALL_ENABLED);
    expect(result.allowed).toBe(false);
    expect(result.blockedReason).toBe("role");
  });

  it("keeps inventory route when only stock transfer feature disabled", () => {
    const inventoryOnly = resolveOperationsRouteAccess("/inventory", ["owner"], {
      ...ALL_ENABLED,
      features: { "inventory.stock_transfer": false },
    });
    expect(inventoryOnly.allowed).toBe(true);

    const transfers = resolveOperationsRouteAccess("/inventory/transfers", ["owner"], {
      ...ALL_ENABLED,
      features: { "inventory.stock_transfer": false },
    });
    expect(transfers.allowed).toBe(false);
    expect(transfers.blockedReason).toBe("feature");
  });

  it("fails conservatively when capabilities unavailable", () => {
    const result = resolveOperationsRouteAccess("/inventory", ["owner"], null);
    expect(result.allowed).toBe(false);
    expect(result.blockedReason).toBe("capabilities_unavailable");
  });

  it("allows overview without capability guard", () => {
    const result = resolveOperationsRouteAccess("/overview", ["owner"], null);
    expect(result.allowed).toBe(true);
  });
});

describe("capability refresh nav behaviour", () => {
  it("updates nav when capabilities change from enabled to disabled", () => {
    const enabledNav = getNavForRolesWithCapabilities(["owner"], ALL_ENABLED);
    const disabledNav = getNavForRolesWithCapabilities(["owner"], {
      ...ALL_ENABLED,
      modules: { ...ALL_ENABLED.modules, payroll: false },
    });
    expect(enabledNav.some((item) => item.id === "payroll")).toBe(true);
    expect(disabledNav.some((item) => item.id === "payroll")).toBe(false);
  });
});

describe("operating mode nav depth", () => {
  it("STANDARD depth still exposes enabled inventory", () => {
    const nav = getNavForRolesWithCapabilities(["owner"], { ...ALL_ENABLED, navDepth: 2 });
    expect(nav.some((item) => item.id === "pos_store")).toBe(true);
  });
});
