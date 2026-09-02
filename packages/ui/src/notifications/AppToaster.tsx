"use client";

import { useEffect, useState } from "react";
import { registerNotifyPush, type ToastItem } from "./notify";

const TYPE_STYLES: Record<ToastItem["type"], { bg: string; border: string; icon: string }> = {
  success: { bg: "#059669", border: "#34d399", icon: "✓" },
  error: { bg: "#dc2626", border: "#f87171", icon: "!" },
  info: { bg: "#2563eb", border: "#60a5fa", icon: "i" },
  warning: { bg: "#d97706", border: "#fbbf24", icon: "!" },
};

export function AppToaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    registerNotifyPush((toast) => {
      setToasts((prev) => [...prev, toast].slice(-5));
    });
    return () => registerNotifyPush(null);
  }, []);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.duration),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 360,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => {
        const style = TYPE_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 12,
              background: style.bg,
              border: `1px solid ${style.border}`,
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.4,
              boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
              pointerEvents: "auto",
              animation: "kaana-toast-in 0.2s ease-out",
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {style.icon}
            </span>
            <span>{toast.message}</span>
          </div>
        );
      })}
      <style>{`
        @keyframes kaana-toast-in {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
