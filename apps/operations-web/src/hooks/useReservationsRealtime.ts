"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { WS_URL } from "@/lib/api";
import { WS_CHANNELS } from "@kaana/shared-types";

export function useReservationsRealtime(outletId: string, onUpdate: () => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!outletId) return;

    const socket = io(WS_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join", { channel: WS_CHANNELS.outletReservations(outletId) });
      socket.emit("join", { channel: WS_CHANNELS.outletWaitlist(outletId) });
      socket.emit("join", { channel: WS_CHANNELS.outletOrders(outletId) });
    });

    socket.on("reservation:update", onUpdate);
    socket.on("waitlist:update", onUpdate);
    socket.on("order:update", onUpdate);

    return () => {
      socket.disconnect();
    };
  }, [outletId, onUpdate]);
}
