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
  /** Opens in Reservations app (localhost:3006) with auth handoff */
  externalReservations?: boolean;
}

export interface OperationsModule {
  id: string;
  label: string;
  href: string;
  roles: UserRole[];
  /** Prefix match for route guard */
  pathPrefix: string;
  externalReservations?: boolean;
}

function publicUrl(value: string | undefined, fallback: string): string {
  const raw = (value ?? "").trim();
  return raw ? raw.replace(/\/+$/, "") : fallback;
}

export const OPERATIONS_WEB_URL = publicUrl(process.env.NEXT_PUBLIC_OPERATIONS_WEB_URL, "http://localhost:3010");
export const HQ_ADMIN_URL = publicUrl(process.env.NEXT_PUBLIC_HQ_ADMIN_URL, "http://localhost:3000");
export const POS_WEB_URL = publicUrl(process.env.NEXT_PUBLIC_POS_WEB_URL, "http://localhost:3001");
export const KDS_WEB_URL = publicUrl(process.env.NEXT_PUBLIC_KDS_WEB_URL, "http://localhost:3002");
export const CAPTAIN_WEB_URL = publicUrl(process.env.NEXT_PUBLIC_CAPTAIN_WEB_URL, "http://localhost:3003");
export const RESERVATIONS_WEB_URL = publicUrl(process.env.NEXT_PUBLIC_RESERVATIONS_WEB_URL, "http://localhost:3006");

/** @deprecated Use getAppLoginUrl("operations") — each staff app has its own login page. */
export const LOGIN_PORTAL_URL = OPERATIONS_WEB_URL;

export type StaffAppId = "operations" | "pos" | "kds" | "captain";

const APP_LOGIN_BASE: Record<StaffAppId, string> = {
  operations: OPERATIONS_WEB_URL,
  pos: POS_WEB_URL,
  kds: KDS_WEB_URL,
  captain: CAPTAIN_WEB_URL,
};

export function getAppLoginUrl(app: StaffAppId, returnTo?: string): string {
  const base = APP_LOGIN_BASE[app];
  if (!returnTo) return base;
  return `${base}/?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Owner / back-office console (operations-web) */
export const OPERATIONS_MODULES: OperationsModule[] = [
  { id: "overview", label: "Overview", href: "/overview", roles: ["owner", "manager"], pathPrefix: "/overview" },
  { id: "live-orders", label: "Live Orders", href: "/live-orders", roles: ["owner", "manager"], pathPrefix: "/live-orders" },
  { id: "orders", label: "Orders", href: "/orders", roles: ["owner", "manager"], pathPrefix: "/orders" },
  {
    id: "reservations",
    label: "Reservations",
    href: "/reservations",
    roles: ["owner", "manager"],
    pathPrefix: "/reservations",
  },
  { id: "menu", label: "Menu", href: "/menu", roles: ["owner", "manager"], pathPrefix: "/menu" },
  { id: "payroll", label: "Payroll", href: "/payroll", roles: ["owner", "accountant"], pathPrefix: "/payroll" },
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
  { id: "inbox", label: "Online Orders", href: "/inbox", roles: ["biller", "manager"], pathPrefix: "/inbox" },
  { id: "takeaway", label: "Takeaway", href: "/takeaway", roles: ["biller", "manager"], pathPrefix: "/takeaway" },
  { id: "delivery", label: "Delivery", href: "/delivery", roles: ["biller", "manager"], pathPrefix: "/delivery" },
  { id: "inventory", label: "Inventory", href: "/inventory", roles: ["biller", "inventory_manager", "manager"], pathPrefix: "/inventory" },
  { id: "purchases", label: "Purchases", href: "/purchases", roles: ["biller", "inventory_manager", "manager"], pathPrefix: "/purchases" },
];

/** Default entry route per role within operations-web (owner app) */
export const OPERATIONS_ENTRY: Partial<Record<UserRole, string>> = {
  owner: "/overview",
  manager: "/overview",
  accountant: "/payroll",
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
    appName: "Kaana Kitchens Platform Admin",
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
    appName: "Kaana Kitchens Owner Console",
    entryRoute: "/overview",
    nav: [],
    allowedApiPrefixes: ["/api"],
  },
  manager: {
    role: "manager",
    appName: "Kaana Kitchens Owner Console",
    entryRoute: "/overview",
    nav: [],
    allowedApiPrefixes: ["/api/orders", "/api/reservations", "/api/approvals", "/api/devices", "/api/staff"],
  },
  biller: {
    role: "biller",
    appName: "Kaana Kitchens POS",
    entryRoute: "/floor",
    nav: [
      { id: "floor", label: "Counter", href: "/floor" },
      { id: "inbox", label: "Online Orders", href: "/inbox" },
      { id: "takeaway", label: "Takeaway", href: "/takeaway" },
      { id: "delivery", label: "Delivery", href: "/delivery" },
      { id: "inventory", label: "Inventory", href: "/inventory" },
      { id: "purchases", label: "Purchases", href: "/purchases" },
    ],
    allowedApiPrefixes: ["/api/orders", "/api/menu", "/api/inventory", "/api/staff", "/api/reservations", "/api/waitlist", "/hub"],
  },
  captain: {
    role: "captain",
    appName: "Kaana Kitchens Captain",
    entryRoute: "/floor",
    nav: [
      { id: "floor", label: "Tables", href: "/floor" },
    ],
    allowedApiPrefixes: ["/hub/orders", "/hub/tables", "/hub/menu"],
  },
  chef: {
    role: "chef",
    appName: "Kaana Kitchens KDS",
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
    appName: "Kaana Kitchens POS",
    entryRoute: "/inventory",
    nav: [
      { id: "inventory", label: "Inventory", href: "/inventory" },
      { id: "purchases", label: "Purchases", href: "/purchases" },
    ],
    allowedApiPrefixes: ["/api/inventory", "/hub/inventory"],
  },
  accountant: {
    role: "accountant",
    appName: "Kaana Kitchens Owner Console",
    entryRoute: "/payroll",
    nav: [],
    allowedApiPrefixes: ["/api/reports", "/api/payroll"],
  },
};

export const APP_URLS: Record<UserRole, string> = {
  super_admin: HQ_ADMIN_URL,
  owner: OPERATIONS_WEB_URL,
  manager: OPERATIONS_WEB_URL,
  biller: POS_WEB_URL,
  captain: CAPTAIN_WEB_URL,
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
    if (mod.externalReservations) {
      if (mod.roles.some((r) => roles.includes(r)) && !seen.has(mod.id)) {
        seen.add(mod.id);
        items.push({ id: mod.id, label: mod.label, href: mod.href, externalReservations: true });
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
  if (roles.includes("owner")) {
    return POS_MODULES.map((m) => ({ id: m.id, label: m.label, href: m.href }));
  }
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

/** Fallback route when POS access is denied (stay inside POS, not owner console). */
export function getPosDeniedRedirect(primary: UserRole): string {
  if (usesPosApp(primary)) return POS_ENTRY[primary] ?? "/floor";
  if (primary === "manager" || primary === "owner") return "/floor";
  return getAppEntryForRole(primary);
}

export function canAccessRoute(roles: UserRole[], pathname: string): boolean {
  if (roles.includes("owner")) return true;
  if (pathname.startsWith("/inventory") || pathname.startsWith("/purchases")) {
    return roles.some((r) => ["owner", "manager"].includes(r));
  }
  return OPERATIONS_MODULES.some(
    (m) =>
      m.id !== "pos_store" &&
      !m.externalReservations &&
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

export function buildReservationsLink(path: string, handoff: AuthHandoffPayload): string {
  return buildRedirectWithAuth(RESERVATIONS_WEB_URL, path, handoff);
}

export function getLoginPortalUrl(returnTo?: string): string {
  return getAppLoginUrl("operations", returnTo);
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
