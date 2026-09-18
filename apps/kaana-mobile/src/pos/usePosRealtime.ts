import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { WS_URL } from "../config/env";

export type OrderUpdateEvent = {
  type?: string;
  orderId?: string;
  id?: string;
  orderStatus?: string;
};

export function usePosRealtime(outletId: string | null, onUpdate: (event: OrderUpdateEvent) => void) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!outletId) return;

    const socket: Socket = io(WS_URL);
    const channel = `outlet:${outletId}:orders`;
    socket.emit("join", { channel });
    socket.on("order:update", (payload: OrderUpdateEvent) => {
      callbackRef.current(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, [outletId]);
}
