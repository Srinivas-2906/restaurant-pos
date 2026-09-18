import { WS_CHANNELS } from "@kaana/shared-types";
import { io, type Socket } from "socket.io-client";
import { WS_URL } from "../config/env";

export type ConfigUpdateHandler = (payload: { organizationId: string; configVersion: number }) => void;
export type DeviceRevokedHandler = (payload: { organizationId: string; terminalId: string }) => void;

export function subscribeOrgRealtime(
  organizationId: string,
  handlers: {
    onConfigUpdate?: ConfigUpdateHandler;
    onDeviceRevoked?: DeviceRevokedHandler;
  },
): () => void {
  const socket: Socket = io(WS_URL, { transports: ["websocket", "polling"] });
  const channel = WS_CHANNELS.orgConfig(organizationId);

  socket.on("connect", () => {
    socket.emit("join", { channel });
  });

  socket.on("config:update", (payload: { organizationId: string; configVersion: number }) => {
    if (payload.organizationId === organizationId) {
      handlers.onConfigUpdate?.(payload);
    }
  });

  socket.on("device:revoked", (payload: { organizationId: string; terminalId: string }) => {
    if (payload.organizationId === organizationId) {
      handlers.onDeviceRevoked?.(payload);
    }
  });

  return () => {
    socket.emit("leave", { channel });
    socket.disconnect();
  };
}
