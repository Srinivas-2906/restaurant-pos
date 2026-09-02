"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { WS_URL } from "@/lib/api";

export function useOrdersRealtime(outletId: string | null, onUpdate: () => void) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!outletId) return;
    const socket = io(WS_URL);
    socket.emit("join", { channel: `outlet:${outletId}:orders` });
    socket.on("order:update", () => callbackRef.current());
    return () => {
      socket.disconnect();
    };
  }, [outletId]);
}
