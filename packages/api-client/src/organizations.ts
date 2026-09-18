import type { ApiClient } from "./http";

export type OutletSummary = {
  id: string;
  name: string;
  code: string;
  type?: string;
};

export type OrganizationDashboard = {
  totalOutlets: number;
  outletId?: string;
  todayOrders: number;
  todayRevenue: number;
  yesterdayOrders?: number;
  yesterdayRevenue?: number;
  ordersDelta?: number;
  revenueDelta?: number;
};

export function createOrganizationsApi(client: ApiClient) {
  return {
    dashboard(outletId?: string) {
      const path = outletId
        ? `/organizations/dashboard?outletId=${outletId}`
        : "/organizations/dashboard";
      return client.api<OrganizationDashboard>(path);
    },
    list() {
      return client.api<
        Array<{
          id: string;
          name: string;
          brands?: Array<{
            outlets?: OutletSummary[];
          }>;
        }>
      >("/organizations");
    },
  };
}

export function flattenOutlets(
  orgs: Array<{ brands?: Array<{ outlets?: OutletSummary[] }> }>,
): OutletSummary[] {
  const outlets: OutletSummary[] = [];
  for (const org of orgs) {
    for (const brand of org.brands ?? []) {
      for (const outlet of brand.outlets ?? []) {
        outlets.push(outlet);
      }
    }
  }
  return outlets;
}
