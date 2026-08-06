import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Package,
  Truck,
  Wallet,
  Users,
  UserCircle,
  BarChart3,
  Store,
  Monitor,
  Settings,
  LifeBuoy,
} from "lucide-react";

export const MODULE_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  orders: ShoppingBag,
  menu: UtensilsCrossed,
  inventory: Package,
  purchases: Truck,
  payroll: Wallet,
  finance: Wallet,
  pos_store: Package,
  staff: Users,
  customers: UserCircle,
  reports: BarChart3,
  outlets: Store,
  devices: Monitor,
  settings: Settings,
  support: LifeBuoy,
};

export function getModuleIcon(id: string): LucideIcon {
  return MODULE_ICONS[id] ?? LayoutDashboard;
}
