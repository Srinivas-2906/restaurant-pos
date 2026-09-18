import type { CapabilityBootstrapPayload, ResolvedCapabilities } from "@kaana/shared-types";

import { WS_CHANNELS } from "@kaana/shared-types";

import type { ApiClient } from "./http";



const CAPABILITIES_KEY = "kaana_capabilities";

const LEGACY_CAPABILITIES_KEY = "capabilities";

const CONFIG_VERSION_KEY = "kaana_config_version";



export function createCapabilitiesApi(client: ApiClient) {

  return {

    fetchMe() {

      return client

        .api<{ success: boolean; data: CapabilityBootstrapPayload }>("/capabilities/me")

        .then((res) => res.data);

    },

  };

}



export function persistCapabilities(payload: ResolvedCapabilities & { resolvedAt?: string }): void {

  if (typeof window === "undefined") return;

  const serialized = JSON.stringify(payload);

  localStorage.setItem(CAPABILITIES_KEY, serialized);

  localStorage.setItem(LEGACY_CAPABILITIES_KEY, serialized);

  localStorage.setItem(CONFIG_VERSION_KEY, String(payload.configVersion));

}



export function readStoredCapabilities(): CapabilityBootstrapPayload | null {

  if (typeof window === "undefined") return null;

  const raw =

    localStorage.getItem(CAPABILITIES_KEY) ?? localStorage.getItem(LEGACY_CAPABILITIES_KEY);

  if (!raw) return null;

  try {

    return JSON.parse(raw) as CapabilityBootstrapPayload;

  } catch {

    return null;

  }

}



export function readStoredConfigVersion(): number {

  if (typeof window === "undefined") return 0;

  return Number(localStorage.getItem(CONFIG_VERSION_KEY) ?? 0);

}



export type ConfigUpdateHandler = (payload: { organizationId: string; configVersion: number }) => void;



/** Subscribe to org config version updates via Socket.IO `/events` namespace. */

export function subscribeConfigUpdates(

  organizationId: string,

  _token: string,

  onUpdate: ConfigUpdateHandler,

  wsUrl = "http://localhost:4000/events",

): () => void {

  if (typeof window === "undefined") return () => undefined;



  // eslint-disable-next-line @typescript-eslint/no-require-imports

  const { io } = require("socket.io-client") as typeof import("socket.io-client");

  const socket = io(wsUrl, { transports: ["websocket", "polling"] });

  const channel = WS_CHANNELS.orgConfig(organizationId);



  socket.on("connect", () => {

    socket.emit("join", { channel });

  });



  socket.on("config:update", (payload: { organizationId: string; configVersion: number }) => {

    if (payload.organizationId === organizationId) {

      onUpdate(payload);

    }

  });



  return () => {

    socket.emit("leave", { channel });

    socket.disconnect();

  };

}


