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
}

export interface OperationsModule {
  id: string;
  label: string;
  href: string;
  roles: UserRole[];
  /** Prefix match for route guard */
  pathPrefix: string;
}

/** Central restaurant console modules (operations-web) */
export const OPERATIONS_MODULES: OperationsModule[] = [
  { id: "overview", label: "Overview", href: "/overview", roles: ["owner", "manager"], pathPrefix: "/overview" },
  { id: "orders", label: "Orders", href: "/orders", roles: ["owner", "manager"], pathPrefix: "/orders" },
  { id: "menu", label: "Menu", href: "/menu", roles: ["owner", "manager"], pathPrefix: "/menu" },
  { id: "inventory", label: "Inventory", href: "/inventory", roles: ["owner", "manager", "inventory_manager"], pathPrefix: "/inventory" },
  { id: "purchases", label: "Purchases", href: "/purchases", roles: ["owner", "manager", "inventory_manager"], pathPrefix: "/purchases" },
  { id: "finance", label: "Finance", href: "/finance", roles: ["owner", "accountant"], pathPrefix: "/finance" },
  { id: "staff", label: "Staff", href: "/staff", roles: ["owner", "manager"], pathPrefix: "/staff" },
  { id: "customers", label: "Customers", href: "/customers", roles: ["owner", "manager"], pathPrefix: "/customers" },
  { id: "reports", label: "Reports", href: "/reports", roles: ["owner", "manager", "accountant"], pathPrefix: "/reports" },
  { id: "outlets", label: "Outlets", href: "/outlets", roles: ["owner"], pathPrefix: "/outlets" },
  { id: "devices", label: "Devices", href: "/devices", roles: ["owner", "manager"], pathPrefix: "/devices" },
  { id: "settings", label: "Settings", href: "/settings", roles: ["owner"], pathPrefix: "/settings" },
  { id: "support", label: "Support", href: "/support", roles: ["owner", "manager"], pathPrefix: "/support" },
];

export const OPERATIONS_WEB_URL = "http://localhost:3010";
export const HQ_ADMIN_URL = "http://localhost:3000";

/** Default entry route per role within operations-web */
export const OPERATIONS_ENTRY: Partial<Record<UserRole, string>> = {
  owner: "/overview",
  manager: "/overview",
  inventory_manager: "/inventory",
  accountant: "/finance",
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
    appName: "Kaana Operations",
    entryRoute: "/overview",
    nav: [],
    allowedApiPrefixes: ["/api"],
  },
  manager: {
    role: "manager",
    appName: "Kaana Operations",
    entryRoute: "/overview",
    nav: [],
    allowedApiPrefixes: ["/api/orders", "/api/reservations", "/api/approvals", "/api/devices", "/api/staff"],
  },
  biller: {
    role: "biller",
    appName: "Kaana Counter POS",
    entryRoute: "/floor",
    nav: [
      { id: "floor", label: "Floor", href: "/floor" },
      { id: "inbox", label: "Order Inbox", href: "/inbox" },
      { id: "dayclose", label: "Day Close", href: "/day-close" },
      { id: "diagnostics", label: "Diagnostics", href: "/diagnostics" },
    ],
    allowedApiPrefixes: ["/api/orders", "/api/menu", "/hub"],
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
    appName: "Kaana Operations",
    entryRoute: "/inventory",
    nav: [],
    allowedApiPrefixes: ["/api/inventory", "/hub/inventory"],
  },
  accountant: {
    role: "accountant",
    appName: "Kaana Operations",
    entryRoute: "/finance",
    nav: [],
    allowedApiPrefixes: ["/api/reports", "/api/payroll"],
  },
};

export const APP_URLS: Record<UserRole, string> = {
  super_admin: HQ_ADMIN_URL,
  owner: OPERATIONS_WEB_URL,
  manager: OPERATIONS_WEB_URL,
  biller: "http://localhost:3001",
  captain: "http://localhost:3002",
  chef: "http://localhost:5173",
  inventory_manager: OPERATIONS_WEB_URL,
  accountant: OPERATIONS_WEB_URL,
};

const RESTAURANT_ROLES: UserRole[] = ["owner", "manager", "inventory_manager", "accountant"];

export function isRestaurantRole(role: UserRole): boolean {
  return RESTAURANT_ROLES.includes(role);
}

export function getNavForRoles(roles: UserRole[]): NavItem[] {
  const seen = new Set<string>();
  const items: NavItem[] = [];
  for (const mod of OPERATIONS_MODULES) {
    if (mod.roles.some((r) => roles.includes(r)) && !seen.has(mod.id)) {
      seen.add(mod.id);
      items.push({ id: mod.id, label: mod.label, href: mod.href });
    }
  }
  return items;
}

export function canAccessRoute(roles: UserRole[], pathname: string): boolean {
  if (roles.includes("owner")) return true;
  return OPERATIONS_MODULES.some(
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

export function redirectUrlForRole(role: UserRole, baseUrls: Partial<Record<UserRole, string>> = {}): string {
  const base = baseUrls[role] ?? APP_URLS[role] ?? APP_URLS.biller;
  return `${base}${getAppEntryForRole(role)}`;
}

export function appHomeForRole(role: UserRole, baseUrls: Partial<Record<UserRole, string>> = {}): string {
  return baseUrls[role] ?? APP_URLS[role] ?? APP_URLS.biller;
}
