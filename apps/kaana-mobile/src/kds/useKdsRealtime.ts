import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { WS_URL } from "../config/env";

export type KdsOrderUpdateEvent = {
  type?: string;
  orderId?: string;
  kotId?: string;
  orderStatus?: string;
};

export function useKdsRealtime(outletId: string | null, onUpdate: (event: KdsOrderUpdateEvent) => void) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!outletId) return;

    const socket: Socket = io(WS_URL, { transports: ["websocket"] });
    const channel = `outlet:${outletId}:orders`;
    socket.emit("join", { channel });
    socket.on("connect", () => callbackRef.current({ type: "socket_connected" }));
    socket.on("disconnect", () => callbackRef.current({ type: "socket_disconnected" }));
    socket.on("order:update", (payload: KdsOrderUpdateEvent) => {
      callbackRef.current(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [outletId]);
}
