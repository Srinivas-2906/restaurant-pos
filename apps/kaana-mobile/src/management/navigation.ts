import type { ModuleKey } from "@kaana/shared-types";
import type { ManagementAccess } from "./permissions";

export type ManagementNavItem = {
  id: string;
  label: string;
  href: string;
  module?: ModuleKey;
  requires?: (access: ManagementAccess) => boolean;
};

export const TAB_ITEMS: ManagementNavItem[] = [
  { id: "home", label: "Home", href: "/management" },
  { id: "orders", label: "Orders", href: "/management/orders", module: "pos" },
  {
    id: "inventory",
    label: "Inventory",
    href: "/management/inventory",
    module: "inventory",
    requires: (a) => a.canManageInventory,
  },
  {
    id: "money",
    label: "Money",
    href: "/management/money",
    module: "finance",
    requires: (a) => a.canViewFinanceSummary,
  },
  { id: "more", label: "More", href: "/management/more" },
];

export const MORE_ITEMS: ManagementNavItem[] = [
  {
    id: "sales",
    label: "Sales",
    href: "/management/sales",
    module: "pos",
    requires: (a) => a.canViewReports,
  },
  {
    id: "reports",
    label: "Reports",
    href: "/management/reports",
    module: "reports",
    requires: (a) => a.canViewReports,
  },
  {
    id: "purchases",
    label: "Purchases",
    href: "/management/purchases",
    module: "procurement",
    requires: (a) => a.canManagePurchases,
  },
  {
    id: "expenses",
    label: "Expenses",
    href: "/management/expenses",
    module: "finance",
    requires: (a) => a.canViewFinanceSummary,
  },
  {
    id: "staff",
    label: "Staff",
    href: "/management/staff",
    requires: (a) => a.canManageStaff,
  },
  {
    id: "devices",
    label: "Devices",
    href: "/management/devices",
    module: "devices",
    requires: (a) => a.isOwner || a.isManager,
  },
];

export function filterNavItems(items: ManagementNavItem[], access: ManagementAccess) {
  return items.filter((item) => {
    if (item.module && !access.hasModule(item.module)) return false;
    if (item.requires && !item.requires(access)) return false;
    return true;
  });
}

export function visibleTabItems(access: ManagementAccess) {
  const tabs = filterNavItems(TAB_ITEMS, access);
  return tabs.length >= 2 ? tabs : TAB_ITEMS.filter((t) => t.id === "home" || t.id === "more");
}
