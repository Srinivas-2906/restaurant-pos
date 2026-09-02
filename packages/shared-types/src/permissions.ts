export const APP_ACCESS = {
  access_pos: "access_pos",
  access_kds: "access_kds",
  access_captain: "access_captain",
  access_operations: "access_operations",
} as const;

export type AppAccessPermission = (typeof APP_ACCESS)[keyof typeof APP_ACCESS];

export const ACTION_PERMISSIONS = {
  take_order: "take_order",
  request_bill: "request_bill",
  settle_bill: "settle_bill",
  apply_discount: "apply_discount",
  void_item: "void_item",
  void_order: "void_order",
  refund_payment: "refund_payment",
  open_cash_drawer: "open_cash_drawer",
  transfer_table: "transfer_table",
  merge_table: "merge_table",
  override_price: "override_price",
  manage_kot: "manage_kot",
  view_reports: "view_reports",
} as const;

export type ActionPermission = (typeof ACTION_PERMISSIONS)[keyof typeof ACTION_PERMISSIONS];

export type Permission = AppAccessPermission | ActionPermission;

export const ROLE_PERMISSION_TEMPLATES: Record<string, Permission[]> = {
  super_admin: [
    APP_ACCESS.access_operations,
    APP_ACCESS.access_pos,
    APP_ACCESS.access_kds,
    APP_ACCESS.access_captain,
    ACTION_PERMISSIONS.view_reports,
  ],
  owner: [
    APP_ACCESS.access_operations,
    APP_ACCESS.access_pos,
    APP_ACCESS.access_kds,
    APP_ACCESS.access_captain,
    ACTION_PERMISSIONS.view_reports,
    ACTION_PERMISSIONS.apply_discount,
    ACTION_PERMISSIONS.void_order,
    ACTION_PERMISSIONS.refund_payment,
  ],
  manager: [
    APP_ACCESS.access_operations,
    APP_ACCESS.access_pos,
    APP_ACCESS.access_kds,
    APP_ACCESS.access_captain,
    ACTION_PERMISSIONS.take_order,
    ACTION_PERMISSIONS.settle_bill,
    ACTION_PERMISSIONS.apply_discount,
    ACTION_PERMISSIONS.void_item,
    ACTION_PERMISSIONS.void_order,
    ACTION_PERMISSIONS.refund_payment,
    ACTION_PERMISSIONS.open_cash_drawer,
    ACTION_PERMISSIONS.transfer_table,
    ACTION_PERMISSIONS.merge_table,
    ACTION_PERMISSIONS.override_price,
    ACTION_PERMISSIONS.view_reports,
  ],
  biller: [
    APP_ACCESS.access_pos,
    ACTION_PERMISSIONS.take_order,
    ACTION_PERMISSIONS.settle_bill,
    ACTION_PERMISSIONS.open_cash_drawer,
  ],
  cashier: [
    APP_ACCESS.access_pos,
    ACTION_PERMISSIONS.take_order,
    ACTION_PERMISSIONS.settle_bill,
    ACTION_PERMISSIONS.open_cash_drawer,
  ],
  captain: [
    APP_ACCESS.access_captain,
    ACTION_PERMISSIONS.take_order,
    ACTION_PERMISSIONS.request_bill,
    ACTION_PERMISSIONS.transfer_table,
    ACTION_PERMISSIONS.merge_table,
    ACTION_PERMISSIONS.manage_kot,
  ],
  chef: [
    APP_ACCESS.access_kds,
    ACTION_PERMISSIONS.manage_kot,
  ],
  inventory_manager: [
    APP_ACCESS.access_pos,
    APP_ACCESS.access_operations,
    ACTION_PERMISSIONS.view_reports,
  ],
  accountant: [
    APP_ACCESS.access_operations,
    ACTION_PERMISSIONS.view_reports,
  ],
};

export function resolveEffectivePermissions(assignment: {
  role: string;
  permissions?: unknown;
}): Permission[] {
  const template = ROLE_PERMISSION_TEMPLATES[assignment.role] ?? [];
  const stored = Array.isArray(assignment.permissions)
    ? (assignment.permissions as Permission[])
    : [];
  return [...new Set([...template, ...stored])];
}

export function hasActionPermission(permissions: string[], action: ActionPermission): boolean {
  return permissions.includes(action);
}

export function hasAppAccess(permissions: string[], appAccess: AppAccessPermission): boolean {
  return permissions.includes(appAccess);
}
