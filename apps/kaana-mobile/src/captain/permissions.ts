import { getPermissionsFromToken, getRolesFromToken } from "@kaana/api-client";
import { canUseFeature, isModuleEnabled, type CapabilityBootstrapPayload } from "@kaana/shared-types";

export function resolveCaptainPermissions(
  accessToken: string,
  capabilities: CapabilityBootstrapPayload | null,
) {
  const permissions = getPermissionsFromToken(accessToken);
  const roles = getRolesFromToken(accessToken);
  const captainEnabled = capabilities ? isModuleEnabled(capabilities, "captain") : false;

  const canTakeOrders =
    captainEnabled &&
    (roles.includes("captain") || permissions.includes("take_order") || permissions.includes("access_captain"));

  const canFireKot = canTakeOrders && permissions.includes("manage_kot");
  const canRequestBill = canTakeOrders && permissions.includes("request_bill");
  const canMarkServed = canTakeOrders && roles.includes("captain");
  const canApplyDiscount = permissions.includes("apply_discount");

  return {
    permissions,
    roles,
    captainEnabled,
    canTakeOrders,
    canFireKot,
    canRequestBill,
    canMarkServed,
    canApplyDiscount,
  };
}

export type CaptainPermissions = ReturnType<typeof resolveCaptainPermissions>;
