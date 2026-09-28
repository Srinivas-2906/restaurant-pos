import type { DeviceHeartbeat } from "@kaana/sync-protocol";

import type { ApiClient } from "./http";



export function createDevicesApi(client: ApiClient) {

  return {

    registerDeviceHealth(payload: DeviceHeartbeat) {

      return client.api("/devices/heartbeat", {

        method: "POST",

        body: JSON.stringify(payload),

      });

    },

    listOutletDevices(outletId: string) {

      return client.api(`/devices/outlet/${outletId}`);

    },

    listTerminals() {

      return client.api<Array<Record<string, unknown>>>("/terminals");

    },

    createTerminal(payload: {

      outletId: string;

      name: string;

      deviceType: "pos" | "kds" | "captain";

      code?: string;

    }) {

      return client.api("/terminals", {

        method: "POST",

        body: JSON.stringify(payload),

      });

    },

    redeemTerminalActivationCode(

      code: string,

      deviceId: string,

      deviceMetadata?: Record<string, unknown>,

    ) {

      return client.api("/terminals/activate", {

        method: "POST",

        body: JSON.stringify({ code, deviceId, deviceMetadata }),

      });

    },

    generateTerminalActivationCode(terminalId: string) {

      return client.api<{

        terminalId: string;

        activationCode: string;

        activationCodeDisplay: string;

        expiresAt: string;

      }>(`/terminals/${terminalId}/activation-code`, { method: "POST" });

    },

    cancelTerminalActivationCode(terminalId: string) {

      return client.api(`/terminals/${terminalId}/cancel-activation-code`, { method: "POST" });

    },

    revokeTerminal(terminalId: string) {

      return client.api(`/terminals/${terminalId}/revoke`, { method: "POST" });

    },

    terminalHeartbeat(payload: {

      deviceId?: string;

      appVersion?: string;

      platform?: string;

      osVersion?: string;

      status?: string;

    }) {

      return client.api("/terminals/heartbeat", {

        method: "POST",

        body: JSON.stringify(payload),

      });

    },

  };

}


