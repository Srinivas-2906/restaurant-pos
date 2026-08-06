export type UserRole =
  | "super_admin"
  | "owner"
  | "manager"
  | "biller"
  | "captain"
  | "chef"
  | "inventory_manager"
  | "accountant";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  /** Opens in POS app (localhost:3001) with auth handoff */
  externalPos?: boolean;
}

export interface OperationsModule {
  id: string;
  label: string;
  href: string;
  roles: UserRole[];
  /** Prefix match for route guard */
  pathPrefix: string;
}

export const OPERATIONS_WEB_URL = "http://localhost:3010";
export const HQ_ADMIN_URL = "http://localhost:3000";
export const POS_WEB_URL = "http://localhost:3001";
export const KDS_WEB_URL = "http://localhost:3002";

/** Single sign-in portal for all restaurant staff */
export const LOGIN_PORTAL_URL = OPERATIONS_WEB_URL;

/** Owner / back-office console (operations-web) */
export const OPERATIONS_MODULES: OperationsModule[] = [
  { id: "overview", label: "Overview", href: "/overview", roles: ["owner", "manager"], pathPrefix: "/overview" },
  { id: "orders", label: "Orders", href: "/orders", roles: ["owner", "manager"], pathPrefix: "/orders" },
  { id: "menu", label: "Menu", href: "/menu", roles: ["owner", "manager"], pathPrefix: "/menu" },
  { id: "payroll", label: "Payroll", href: "/finance/payroll", roles: ["owner", "accountant"], pathPrefix: "/finance/payroll" },
  { id: "finance", label: "Finance", href: "/finance", roles: ["owner"], pathPrefix: "/finance" },
  { id: "staff", label: "Staff", href: "/staff", roles: ["owner", "manager"], pathPrefix: "/staff" },
  { id: "customers", label: "Customers", href: "/customers", roles: ["owner", "manager"], pathPrefix: "/customers" },
  { id: "reports", label: "Reports", href: "/reports", roles: ["owner", "manager", "accountant"], pathPrefix: "/reports" },
  { id: "outlets", label: "Outlets", href: "/outlets", roles: ["owner"], pathPrefix: "/outlets" },
  { id: "devices", label: "Devices", href: "/devices", roles: ["owner", "manager"], pathPrefix: "/devices" },
  { id: "settings", label: "Settings", href: "/settings", roles: ["owner"], pathPrefix: "/settings" },
  { id: "support", label: "Support", href: "/support", roles: ["owner", "manager"], pathPrefix: "/support" },
  {
    id: "pos_store",
    label: "Store & Inventory",
    href: "/inventory",
    roles: ["owner", "manager"],
    pathPrefix: "/inventory",
  },
];

/** POS counter app modules (inventory lives here) */
export const POS_MODULES: OperationsModule[] = [
  { id: "floor", label: "Counter", href: "/floor", roles: ["biller", "manager"], pathPrefix: "/floor" },
  { id: "inventory", label: "Inventory", href: "/inventory", roles: ["biller", "inventory_manager", "manager"], pathPrefix: "/inventory" },
  { id: "purchases", label: "Purchases", href: "/purchases", roles: ["biller", "inventory_manager", "manager"], pathPrefix: "/purchases" },
];

/** Default entry route per role within operations-web (owner app) */
export const OPERATIONS_ENTRY: Partial<Record<UserRole, string>> = {
  owner: "/overview",
  manager: "/overview",
  accountant: "/finance/payroll",
};

/** Default entry route per role within POS */
export const POS_ENTRY: Partial<Record<UserRole, string>> = {
  biller: "/floor",
  inventory_manager: "/inventory",
  manager: "/floor",
};

export interface RoleShell {
  role: UserRole;
  appName: string;
  entryRoute: string;
  nav: NavItem[];
  allowedApiPrefixes: string[];
}

export const ROLE_SHELLS: Record<UserRole, RoleShell> = {
  super_admin: {
    role: "super_admin",
    appName: "Kaana Platform Admin",
    entryRoute: "/dashboard",
    nav: [
      { id: "dashboard", label: "Dashboard", href: "/dashboard" },
      { id: "tenants", label: "Tenants", href: "/tenants" },
      { id: "users", label: "Users", href: "/users" },
      { id: "support", label: "Support", href: "/support" },
    ],
    allowedApiPrefixes: ["/api"],
  },
  owner: {
    role: "owner",
    appName: "Kaana Owner Console",
    entryRoute: "/overview",
    nav: [],
    allowedApiPrefixes: ["/api"],
  },
  manager: {
    role: "manager",
    appName: "Kaana Owner Console",
    entryRoute: "/overview",
    nav: [],
    allowedApiPrefixes: ["/api/orders", "/api/reservations", "/api/approvals", "/api/devices", "/api/staff"],
  },
  biller: {
    role: "biller",
    appName: "Kaana POS",
    entryRoute: "/floor",
    nav: [
      { id: "floor", label: "Counter", href: "/floor" },
      { id: "inventory", label: "Inventory", href: "/inventory" },
      { id: "purchases", label: "Purchases", href: "/purchases" },
    ],
    allowedApiPrefixes: ["/api/orders", "/api/menu", "/api/inventory", "/api/staff", "/hub"],
  },
  captain: {
    role: "captain",
    appName: "Kaana Captain",
    entryRoute: "/floor",
    nav: [
      { id: "floor", label: "Tables", href: "/floor" },
      { id: "reservations", label: "Reservations", href: "/reservations" },
    ],
    allowedApiPrefixes: ["/hub/orders", "/hub/tables", "/hub/menu"],
  },
  chef: {
    role: "chef",
    appName: "Kaana KDS",
    entryRoute: "/station",
    nav: [
      { id: "board", label: "Ticket Board", href: "/board" },
      { id: "aggregate", label: "Rush View", href: "/aggregate" },
      { id: "eighty-six", label: "86 Items", href: "/eighty-six" },
    ],
    allowedApiPrefixes: ["/hub/kds"],
  },
  inventory_manager: {
    role: "inventory_manager",
    appName: "Kaana POS",
    entryRoute: "/inventory",
    nav: [
      { id: "inventory", label: "Inventory", href: "/inventory" },
      { id: "purchases", label: "Purchases", href: "/purchases" },
    ],
    allowedApiPrefixes: ["/api/inventory", "/hub/inventory"],
  },
  accountant: {
    role: "accountant",
    appName: "Kaana Owner Console",
    entryRoute: "/finance/payroll",
    nav: [],
    allowedApiPrefixes: ["/api/reports", "/api/payroll"],
  },
};

export const APP_URLS: Record<UserRole, string> = {
  super_admin: HQ_ADMIN_URL,
  owner: OPERATIONS_WEB_URL,
  manager: OPERATIONS_WEB_URL,
  biller: POS_WEB_URL,
  captain: "http://localhost:8081",
  chef: KDS_WEB_URL,
  inventory_manager: POS_WEB_URL,
  accountant: OPERATIONS_WEB_URL,
};

const RESTAURANT_ROLES: UserRole[] = ["owner", "manager", "inventory_manager", "accountant"];
const POS_ROLES: UserRole[] = ["biller", "inventory_manager"];

export function isRestaurantRole(role: UserRole): boolean {
  return RESTAURANT_ROLES.includes(role);
}

export function isPosRole(role: UserRole): boolean {
  return POS_ROLES.includes(role);
}

export function usesPosApp(role: UserRole): boolean {
  return role === "biller" || role === "inventory_manager";
}

export function getNavForRoles(roles: UserRole[]): NavItem[] {
  const seen = new Set<string>();
  const items: NavItem[] = [];
  for (const mod of OPERATIONS_MODULES) {
    if (mod.id === "pos_store") {
      if (mod.roles.some((r) => roles.includes(r)) && !seen.has(mod.id)) {
        seen.add(mod.id);
        items.push({ id: mod.id, label: mod.label, href: mod.href, externalPos: true });
      }
      continue;
    }
    if (mod.roles.some((r) => roles.includes(r)) && !seen.has(mod.id)) {
      seen.add(mod.id);
      items.push({ id: mod.id, label: mod.label, href: mod.href });
    }
  }
  return items;
}

export function getPosNavForRoles(roles: UserRole[]): NavItem[] {
  const seen = new Set<string>();
  const items: NavItem[] = [];
  for (const mod of POS_MODULES) {
    if (mod.roles.some((r) => roles.includes(r)) && !seen.has(mod.id)) {
      seen.add(mod.id);
      items.push({ id: mod.id, label: mod.label, href: mod.href });
    }
  }
  return items;
}

export function canAccessRoute(roles: UserRole[], pathname: string): boolean {
  if (roles.includes("owner")) return true;
  if (pathname.startsWith("/inventory") || pathname.startsWith("/purchases")) {
    return roles.some((r) => ["owner", "manager"].includes(r));
  }
  return OPERATIONS_MODULES.some(
    (m) =>
      m.id !== "pos_store" &&
      m.roles.some((r) => roles.includes(r)) &&
      (pathname === m.pathPrefix || pathname.startsWith(`${m.pathPrefix}/`)),
  );
}

export function canAccessPosRoute(roles: UserRole[], pathname: string): boolean {
  if (roles.includes("owner")) return true;
  return POS_MODULES.some(
    (m) => m.roles.some((r) => roles.includes(r)) && (pathname === m.pathPrefix || pathname.startsWith(`${m.pathPrefix}/`)),
  );
}

export function getShellForRole(role: UserRole): RoleShell {
  return ROLE_SHELLS[role] ?? ROLE_SHELLS.biller;
}

export function canAccessApi(role: UserRole, path: string): boolean {
  const shell = getShellForRole(role);
  if (role === "super_admin" || role === "owner") return true;
  return shell.allowedApiPrefixes.some((p) => path.startsWith(p));
}

export function getAppEntryForRole(role: UserRole): string {
  if (usesPosApp(role)) {
    return POS_ENTRY[role] ?? getShellForRole(role).entryRoute;
  }
  return OPERATIONS_ENTRY[role] ?? getShellForRole(role).entryRoute;
}

export function resolvePrimaryRole(user: { roles?: Array<{ role: string }> }): UserRole {
  const role = user.roles?.[0]?.role ?? "biller";
  return role as UserRole;
}

export function resolveAllRoles(user: { roles?: Array<{ role: string }> }): UserRole[] {
  const roles = user.roles?.map((r) => r.role as UserRole) ?? [];
  return roles.length > 0 ? roles : ["biller"];
}

export interface AuthHandoffPayload {
  accessToken: string;
  refreshToken: string;
  user: unknown;
  outletId?: string | null;
}

export function buildRedirectWithAuth(baseUrl: string, path: string, handoff: AuthHandoffPayload): string {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, baseUrl);
  url.searchParams.set("token", handoff.accessToken);
  url.searchParams.set("refreshToken", handoff.refreshToken);
  url.searchParams.set("user", encodeURIComponent(JSON.stringify(handoff.user)));
  if (handoff.outletId) url.searchParams.set("outletId", handoff.outletId);
  return url.toString();
}

export function redirectUrlForRole(role: UserRole, baseUrls: Partial<Record<UserRole, string>> = {}): string {
  const base = baseUrls[role] ?? APP_URLS[role] ?? APP_URLS.biller;
  return `${base}${getAppEntryForRole(role)}`;
}

export function redirectUrlForRoleWithAuth(
  role: UserRole,
  handoff: AuthHandoffPayload,
  baseUrls: Partial<Record<UserRole, string>> = {},
): string {
  const base = baseUrls[role] ?? APP_URLS[role] ?? APP_URLS.biller;
  return buildRedirectWithAuth(base, getAppEntryForRole(role), handoff);
}

export function buildPosLink(path: string, handoff: AuthHandoffPayload): string {
  return buildRedirectWithAuth(POS_WEB_URL, path, handoff);
}

export function getLoginPortalUrl(returnTo?: string): string {
  if (!returnTo) return LOGIN_PORTAL_URL;
  return `${LOGIN_PORTAL_URL}/?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Apply auth tokens passed from the unified login portal (client-side only). */
export function applyAuthHandoffFromSearchParams(searchParams: URLSearchParams): boolean {
  if (typeof window === "undefined") return false;
  const token = searchParams.get("token");
  const userRaw = searchParams.get("user");
  if (!token || !userRaw) return false;
  localStorage.setItem("token", token);
  const refresh = searchParams.get("refreshToken");
  if (refresh) localStorage.setItem("refreshToken", refresh);
  try {
    localStorage.setItem("user", decodeURIComponent(userRaw));
  } catch {
    localStorage.setItem("user", userRaw);
  }
  const outletId = searchParams.get("outletId");
  if (outletId) localStorage.setItem("selectedOutletId", outletId);
  const user = JSON.parse(localStorage.getItem("user") || "{}") as {
    id?: string;
    roles?: Array<{ role: string }>;
  };
  if (user.id) localStorage.setItem("userId", user.id);
  return true;
}

export function readAuthHandoffFromStorage(): AuthHandoffPayload | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  const userRaw = localStorage.getItem("user");
  if (!token || !userRaw) return null;
  return {
    accessToken: token,
    refreshToken: localStorage.getItem("refreshToken") ?? "",
    user: JSON.parse(userRaw),
    outletId: localStorage.getItem("selectedOutletId"),
  };
}

export function appHomeForRole(role: UserRole, baseUrls: Partial<Record<UserRole, string>> = {}): string {
  return baseUrls[role] ?? APP_URLS[role] ?? APP_URLS.biller;
}
