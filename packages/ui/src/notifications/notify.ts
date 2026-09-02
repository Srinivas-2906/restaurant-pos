export type NotifyType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  type: NotifyType;
  duration: number;
}

type PushFn = (toast: ToastItem) => void;

let pushFn: PushFn | null = null;

export function registerNotifyPush(fn: PushFn | null) {
  pushFn = fn;
}

function push(message: string, type: NotifyType, duration = 4000) {
  if (!pushFn) return;
  pushFn({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    type,
    duration,
  });
}

export const notify = {
  show: push,
  success: (message: string, duration?: number) => push(message, "success", duration),
  error: (message: string, duration?: number) => push(message, "error", duration ?? 5000),
  info: (message: string, duration?: number) => push(message, "info", duration),
  warning: (message: string, duration?: number) => push(message, "warning", duration),
};
