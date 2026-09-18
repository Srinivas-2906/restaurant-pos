import { getPermissionsFromToken, getRolesFromToken } from "@kaana/api-client";
import { canUseFeature, isModuleEnabled, type CapabilityBootstrapPayload } from "@kaana/shared-types";

export function resolvePosPermissions(
  accessToken: string,
  capabilities: CapabilityBootstrapPayload | null,
) {
  const permissions = getPermissionsFromToken(accessToken);
  const roles = getRolesFromToken(accessToken);
  const isOwner = roles.includes("owner");
  const isManager = roles.includes("manager");
  const isBiller = roles.includes("biller") || permissions.includes("take_order");

  const posEnabled = capabilities ? isModuleEnabled(capabilities, "pos") : false;
  const canBill =
    posEnabled &&
    (isOwner ||
      isManager ||
      isBiller ||
      permissions.includes("access_pos") ||
      permissions.includes("take_order"));

  const canSettle =
    posEnabled &&
    (isOwner ||
      isManager ||
      permissions.includes("settle_bill") ||
      permissions.includes("take_order"));

  const canApplyDiscount =
    posEnabled &&
    (isOwner || permissions.includes("apply_discount")) &&
    (!capabilities || canUseFeature(capabilities, "pos.discount"));

  const canCancel =
    posEnabled && (isOwner || isManager || permissions.includes("void_order"));

  const canFireKot = posEnabled && (isOwner || isBiller || permissions.includes("take_order"));

  return {
    permissions,
    roles,
    isOwner,
    isManager,
    posEnabled,
    canBill,
    canSettle,
    canApplyDiscount,
    canCancel,
    canFireKot,
  };
}

export type PosPermissions = ReturnType<typeof resolvePosPermissions>;

/** Offline session — permissions from cached staff snapshot (no JWT). */
export function resolvePosPermissionsFromList(
  permissions: string[],
  role: string,
  capabilities: CapabilityBootstrapPayload | null,
) {
  const roles = [role];
  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isBiller = role === "biller" || permissions.includes("take_order");
  const posEnabled = capabilities ? isModuleEnabled(capabilities, "pos") : true;

  return {
    permissions,
    roles,
    isOwner,
    isManager,
    posEnabled,
    canBill:
      posEnabled &&
      (isOwner || isManager || isBiller || permissions.includes("access_pos") || permissions.includes("take_order")),
    canSettle:
      posEnabled &&
      (isOwner || isManager || permissions.includes("settle_bill") || permissions.includes("take_order")),
    canApplyDiscount:
      posEnabled &&
      (isOwner || permissions.includes("apply_discount")) &&
      (!capabilities || canUseFeature(capabilities, "pos.discount")),
    canCancel: posEnabled && (isOwner || isManager || permissions.includes("void_order")),
    canFireKot: posEnabled && (isOwner || isBiller || permissions.includes("take_order")),
  };
}
