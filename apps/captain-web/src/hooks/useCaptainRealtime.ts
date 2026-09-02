"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { WS_URL } from "@/lib/api";

export interface CaptainOrderEvent {
  type?: string;
  orderId?: string;
  tableId?: string;
}

export function useCaptainRealtime(outletId: string | null, onUpdate: (event: CaptainOrderEvent) => void) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!outletId) return;
    const socket = io(WS_URL);
    socket.emit("join", { channel: `outlet:${outletId}:orders` });
    socket.on("order:update", (payload: CaptainOrderEvent) => {
      callbackRef.current(payload);
    });
    return () => { socket.disconnect(); };
  }, [outletId]);
}
