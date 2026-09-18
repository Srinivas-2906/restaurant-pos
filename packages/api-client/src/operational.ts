import type { ApiClient } from "./http";

export type TerminalCredential = { terminalId: string; deviceSecret: string };

export type EligibleStaffMember = {
  id: string;
  displayName: string;
  employeeCode: string;
  profilePhotoUrl: string | null;
};

export function createOperationalApi(
  client: ApiClient,
  getTerminalCredential: () => TerminalCredential | null,
  storage: {
    setOperationalSession: (data: {
      accessToken: string;
      refreshToken?: string;
      staff: { id: string; displayName: string; employeeCode: string; role: string };
      outletId: string;
      terminalId: string;
    }) => void;
  },
) {
  async function terminalApi<T>(path: string, init: RequestInit = {}): Promise<T> {
    const credential = getTerminalCredential();
    if (!credential) {
      throw new Error("Terminal not registered on this device");
    }

    const res = await fetch(`${client.apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Terminal ${credential.terminalId}:${credential.deviceSecret}`,
        ...init.headers,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.message || err.error || "Request failed");
    }

    return res.json() as Promise<T>;
  }

  return {
    fetchTerminalMe() {
      return terminalApi<{
        id: string;
        name: string;
        code: string;
        deviceType: string;
        outlet: { id: string; name: string; code: string };
      }>("/operational/terminals/me");
    },
    fetchEligibleStaff() {
      return terminalApi<EligibleStaffMember[]>("/operational/terminals/me/eligible-staff");
    },
    pinLogin(staffProfileId: string, pin: string) {
      return terminalApi<{
        accessToken: string;
        refreshToken?: string;
        staff: { id: string; displayName: string; employeeCode: string; role: string };
        outletId: string;
        terminalId: string;
      }>("/operational/pin-login", {
        method: "POST",
        body: JSON.stringify({ staffProfileId, pin }),
      }).then((data) => {
        storage.setOperationalSession(data);
        return data;
      });
    },
    registerTerminal(terminalId: string) {
      return client.api<{
        terminal: { id: string; name: string; code: string; outlet: { id: string; name: string } };
        deviceSecret: string;
      }>(`/terminals/${terminalId}/register`, { method: "POST" });
    },
  };
}
