"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { WS_URL } from "@/lib/api";

export interface OrderUpdateEvent {
  type?: string;
  orderId?: string;
  id?: string;
  source?: string;
  externalOrderId?: string;
  tableId?: string;
  kotNumber?: string;
  kotNumbers?: string[];
  stationName?: string;
  tableNumber?: string | null;
  itemNames?: string[];
  itemName?: string;
  readyCount?: number;
  inKitchenCount?: number;
  servedCount?: number;
  orderStatus?: string;
}

export function usePosRealtime(
  outletId: string | null,
  onUpdate: (event: OrderUpdateEvent) => void,
  onSideChannelUpdate?: () => void,
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;
  const sideRef = useRef(onSideChannelUpdate);
  sideRef.current = onSideChannelUpdate;

  useEffect(() => {
    if (!outletId) return;

    const socket: Socket = io(WS_URL);
    const orderChannel = `outlet:${outletId}:orders`;
    const resChannel = `outlet:${outletId}:reservations`;
    const waitChannel = `outlet:${outletId}:waitlist`;

    socket.emit("join", { channel: orderChannel });
    socket.emit("join", { channel: resChannel });
    socket.emit("join", { channel: waitChannel });

    socket.on("order:update", (payload: OrderUpdateEvent) => {
      callbackRef.current(payload);
    });
    socket.on("reservation:update", () => sideRef.current?.());
    socket.on("waitlist:update", () => sideRef.current?.());

    return () => {
      socket.disconnect();
    };
  }, [outletId]);
}
