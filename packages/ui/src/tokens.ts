export const colors = {
  brand: { 50: "#fff7ed", 100: "#ffedd5", 500: "#f97316", 600: "#ea580c", 700: "#c2410c" },
  success: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  warning: { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
  danger: { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
  info: { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  gray: { 50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 500: "#6b7280", 700: "#374151", 900: "#111827" },
  sync: { online: "#22c55e", degraded: "#eab308", offline: "#ef4444" },
  table: {
    free: { bg: "#dcfce7", border: "#4ade80", text: "#166534" },
    seated: { bg: "#ffedd5", border: "#fb923c", text: "#9a3412" },
    billed: { bg: "#dbeafe", border: "#60a5fa", text: "#1e40af" },
    reserved: { bg: "#f3e8ff", border: "#c084fc", text: "#6b21a8" },
    blocked: { bg: "#f3f4f6", border: "#9ca3af", text: "#4b5563" },
  },
  kds: { new: "#3b82f6", preparing: "#f59e0b", ready: "#22c55e", overdue: "#ef4444" },
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, xl: 24 } as const;
export const fontSize = { xs: 11, sm: 13, md: 15, lg: 18, xl: 24, xxl: 32 } as const;

export const density = {
  pos: { itemHeight: 72, cartWidth: 320, categoryWidth: 120 },
  kds: { itemHeight: 120, cardMinWidth: 280, timerSize: 48 },
  owner: { statHeight: 100, chartHeight: 240 },
} as const;
