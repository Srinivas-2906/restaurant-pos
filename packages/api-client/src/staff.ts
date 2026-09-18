import type { ApiClient } from "./http";

export type StaffMember = {
  id: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  employeeCode: string;
  isActive: boolean;
  outletId?: string | null;
  staffRoleAssignments?: Array<{ role: string; outletId?: string }>;
  outlet?: { id: string; name: string } | null;
};

export function createStaffApi(client: ApiClient) {
  return {
    listByOutlet(outletId: string) {
      return client.api<StaffMember[]>(`/staff/outlets/${outletId}`);
    },
    createEmployee(payload: Record<string, unknown>) {
      return client.api("/staff/employees", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    setPin(profileId: string, pin: string) {
      return client.api(`/staff/profiles/${profileId}/pin`, {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
    },
  };
}
