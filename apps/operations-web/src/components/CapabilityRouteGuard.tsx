"use client";

import { usePathname } from "next/navigation";
import { resolveOperationsRouteAccess } from "@kaana/role-shells";
import { DisabledFeatureRoute } from "@kaana/ui";
import { getRolesForNav } from "@/components/AuthGuard";
import { useCapabilities } from "@/contexts/CapabilitiesContext";

function routeDisabledMessage(blockedReason: string | undefined, label: string) {
  if (blockedReason === "feature") {
    return `${label} is not available for your restaurant at this time.`;
  }
  return `${label} is not enabled for your restaurant.`;
}

export function CapabilityRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { capabilities, ready, error } = useCapabilities();
  const roles = getRolesForNav();

  if (!ready) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 rounded bg-gray-100 animate-pulse mb-4" />
        <div className="h-32 rounded-xl bg-gray-50 animate-pulse" />
      </div>
    );
  }

  const navContext = capabilities
    ? {
        modules: capabilities.modules,
        features: capabilities.features,
        navDepth: capabilities.navDepth,
      }
    : null;

  const access = resolveOperationsRouteAccess(pathname, roles, navContext);

  if (!access.allowed) {
    if (access.blockedReason === "role") {
      return null;
    }

    if (access.blockedReason === "capabilities_unavailable") {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-3">
            <p className="text-sm font-semibold text-gray-900">Loading restaurant configuration</p>
            <p className="text-sm text-gray-600">
              {error ?? "Product settings are temporarily unavailable. Please refresh the page."}
            </p>
          </div>
        </div>
      );
    }

    return (
      <DisabledFeatureRoute
        featureLabel={access.featureLabel ?? "This feature"}
        reason={routeDisabledMessage(access.blockedReason, access.featureLabel ?? "This feature")}
      />
    );
  }

  return <>{children}</>;
}
