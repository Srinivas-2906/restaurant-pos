import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  notify: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

const COLORS: Record<ToastType, string> = {
  success: "#059669",
  error: "#dc2626",
  info: "#2563eb",
  warning: "#d97706",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, type: ToastType) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }].slice(-3));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(
    () => ({
      notify: {
        success: (message: string) => push(message, "success"),
        error: (message: string) => push(message, "error"),
        info: (message: string) => push(message, "info"),
        warning: (message: string) => push(message, "warning"),
      },
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={styles.host}>
        {toasts.map((toast) => (
          <View key={toast.id} style={[styles.toast, { backgroundColor: COLORS[toast.type] }]}>
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useNotify must be used within ToastProvider");
  return ctx.notify;
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 48,
    right: 12,
    left: 12,
    alignItems: "flex-end",
    gap: 8,
    zIndex: 9999,
  },
  toast: {
    maxWidth: 320,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
