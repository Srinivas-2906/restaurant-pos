import { getPermissionsFromToken, getRolesFromToken } from "@kaana/api-client";
import { canUseFeature, isModuleEnabled, type ModuleKey } from "@kaana/shared-types";
import type { CapabilityBootstrapPayload } from "@kaana/shared-types";

export function useManagementAccess(
  accessToken: string | null | undefined,
  capabilities: CapabilityBootstrapPayload | null,
) {
  const permissions = getPermissionsFromToken(accessToken ?? null);
  const roles = getRolesFromToken(accessToken ?? null);
  const isOwner = roles.includes("owner");
  const isManager = roles.includes("manager");

  const hasModule = (key: ModuleKey) =>
    capabilities ? isModuleEnabled(capabilities, key) : false;

  const hasPermission = (permission: string) => permissions.includes(permission);

  const canViewReports = hasPermission("view_reports");
  const canUsePos = hasModule("pos") && (hasPermission("access_pos") || isOwner || isManager);
  const canViewFinanceSummary = hasModule("finance") && canViewReports;
  const canViewOwnerFinance = isOwner && canViewFinanceSummary;
  const canManageStaff = isOwner || isManager;
  const canManageInventory = hasModule("inventory") && (isOwner || isManager || hasPermission("view_reports"));
  const canManagePurchases =
    hasModule("procurement") &&
    !!capabilities &&
    canUseFeature(capabilities, "procurement.purchase_orders") &&
    (isOwner || isManager);

  return {
    roles,
    permissions,
    isOwner,
    isManager,
    hasModule,
    hasPermission,
    canViewReports,
    canUsePos,
    canViewFinanceSummary,
    canViewOwnerFinance,
    canManageStaff,
    canManageInventory,
    canManagePurchases,
  };
}

export type ManagementAccess = ReturnType<typeof useManagementAccess>;
