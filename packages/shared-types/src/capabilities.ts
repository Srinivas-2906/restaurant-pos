export type OperatingMode = "SIMPLE" | "STANDARD" | "ADVANCED" | "ENTERPRISE";

export type SubscriptionPlanId =
  | "LEGACY_FULL"
  | "STARTER"
  | "GROWTH"
  | "PRO"
  | "ENTERPRISE";

export type ModuleKey =
  | "pos"
  | "kds"
  | "captain"
  | "inventory"
  | "procurement"
  | "payroll"
  | "finance"
  | "crm"
  | "reservations"
  | "reports"
  | "devices"
  | "developer";

export type FeatureEntitlementKey =
  | "pos.refund"
  | "pos.discount"
  | "pos.void"
  | "kds.station_routing"
  | "inventory.stock_transfer"
  | "inventory.recipe_consumption"
  | "procurement.purchase_orders"
  | "finance.general_ledger"
  | "payroll.run"
  | "crm.loyalty"
  | "reservations.online"
  | "developer.api";

export type FeatureOverrideState = "DEFAULT" | "ENABLED" | "READ_ONLY" | "DISABLED";

export const ALL_MODULE_KEYS: ModuleKey[] = [
  "pos",
  "kds",
  "captain",
  "inventory",
  "procurement",
  "payroll",
  "finance",
  "crm",
  "reservations",
  "reports",
  "devices",
  "developer",
];

export const ALL_FEATURE_KEYS: FeatureEntitlementKey[] = [
  "pos.refund",
  "pos.discount",
  "pos.void",
  "kds.station_routing",
  "inventory.stock_transfer",
  "inventory.recipe_consumption",
  "procurement.purchase_orders",
  "finance.general_ledger",
  "payroll.run",
  "crm.loyalty",
  "reservations.online",
  "developer.api",
];

export const LEGACY_FULL_MODULES: Record<ModuleKey, boolean> = Object.fromEntries(
  ALL_MODULE_KEYS.map((k) => [k, true]),
) as Record<ModuleKey, boolean>;

export const LEGACY_FULL_FEATURES: Record<FeatureEntitlementKey, boolean> = Object.fromEntries(
  ALL_FEATURE_KEYS.map((k) => [k, true]),
) as Record<FeatureEntitlementKey, boolean>;

export const PLAN_DEFAULTS: Record<
  SubscriptionPlanId,
  { modules: Record<ModuleKey, boolean>; features: Record<FeatureEntitlementKey, boolean> }
> = {
  LEGACY_FULL: { modules: LEGACY_FULL_MODULES, features: LEGACY_FULL_FEATURES },
  STARTER: {
    modules: {
      ...LEGACY_FULL_MODULES,
      payroll: false,
      finance: false,
      procurement: false,
      developer: false,
    },
    features: {
      ...LEGACY_FULL_FEATURES,
      "finance.general_ledger": false,
      "procurement.purchase_orders": false,
      "developer.api": false,
    },
  },
  GROWTH: {
    modules: {
      ...LEGACY_FULL_MODULES,
      developer: false,
    },
    features: {
      ...LEGACY_FULL_FEATURES,
      "developer.api": false,
    },
  },
  PRO: { modules: LEGACY_FULL_MODULES, features: LEGACY_FULL_FEATURES },
  ENTERPRISE: { modules: LEGACY_FULL_MODULES, features: LEGACY_FULL_FEATURES },
};

export const MODE_NAV_DEPTH: Record<OperatingMode, number> = {
  SIMPLE: 1,
  STANDARD: 2,
  ADVANCED: 3,
  ENTERPRISE: 4,
};

/** Modules that must be enabled before enabling a dependent module. */
export const MODULE_DEPENDENCIES: Partial<Record<ModuleKey, ModuleKey[]>> = {
  kds: ["pos"],
  captain: ["pos"],
  procurement: ["inventory"],
};

export const OPERATING_MODES: OperatingMode[] = ["SIMPLE", "STANDARD", "ADVANCED", "ENTERPRISE"];

export const SUBSCRIPTION_PLANS: SubscriptionPlanId[] = [
  "LEGACY_FULL",
  "STARTER",
  "GROWTH",
  "PRO",
  "ENTERPRISE",
];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  pos: "POS",
  kds: "Kitchen Display (KDS)",
  captain: "Captain",
  inventory: "Inventory",
  procurement: "Procurement",
  payroll: "Payroll",
  finance: "Finance",
  crm: "CRM",
  reservations: "Reservations",
  reports: "Reports",
  devices: "Devices",
  developer: "Developer API",
};

export const FEATURE_OVERRIDE_STATES: FeatureOverrideState[] = [
  "DEFAULT",
  "ENABLED",
  "READ_ONLY",
  "DISABLED",
];

export function featuresForModule(moduleKey: ModuleKey): FeatureEntitlementKey[] {
  return ALL_FEATURE_KEYS.filter((key) => key.startsWith(`${moduleKey}.`));
}

export type ModuleEffectiveState =
  | "INHERITED_ENABLED"
  | "INHERITED_DISABLED"
  | "OVERRIDE_ENABLED"
  | "OVERRIDE_DISABLED";

export type FeatureEffectiveState =
  | "INHERITED"
  | "OVERRIDE_ENABLED"
  | "OVERRIDE_READ_ONLY"
  | "OVERRIDE_DISABLED";

export interface ResolvedCapabilities {
  organizationId: string;
  operatingMode: OperatingMode;
  subscriptionPlan: SubscriptionPlanId;
  configVersion: number;
  modules: Record<ModuleKey, boolean>;
  features: Record<FeatureEntitlementKey, boolean>;
  navDepth: number;
}

export interface CapabilityBootstrapPayload extends ResolvedCapabilities {
  resolvedAt: string;
}

export function canUseFeature(
  capabilities: Pick<ResolvedCapabilities, "features">,
  key: FeatureEntitlementKey,
): boolean {
  return capabilities.features[key] === true;
}

export function isModuleEnabled(
  capabilities: Pick<ResolvedCapabilities, "modules">,
  key: ModuleKey,
): boolean {
  return capabilities.modules[key] === true;
}

/** Maps feature entitlements to existing staff permission strings (alias, do not rename permissions). */
export const FEATURE_PERMISSION_MAP: Partial<Record<FeatureEntitlementKey, string[]>> = {
  "pos.refund": ["refund_payment"],
  "pos.discount": ["apply_discount"],
  "pos.void": ["void_item", "void_order"],
  "kds.station_routing": ["manage_kot"],
  "inventory.stock_transfer": ["view_reports"],
  "inventory.recipe_consumption": ["view_reports"],
  "procurement.purchase_orders": ["view_reports"],
  "finance.general_ledger": ["view_reports"],
  "payroll.run": ["view_reports"],
  "crm.loyalty": ["view_reports"],
  "reservations.online": ["view_reports"],
  "developer.api": ["view_reports"],
};
