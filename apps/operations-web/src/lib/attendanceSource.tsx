import {
  Fingerprint,
  Monitor,
  PenLine,
  Smartphone,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type AttendanceSource = "pos" | "manual" | "biometric" | "mobile" | "correction" | string;

export interface AttendanceSourceMeta {
  key: AttendanceSource;
  label: string;
  shortLabel: string;
  description: string;
  Icon: LucideIcon;
  badgeClass: string;
  dotClass: string;
}

export const ATTENDANCE_SOURCES: Record<string, AttendanceSourceMeta> = {
  pos: {
    key: "pos",
    label: "POS terminal",
    shortLabel: "POS",
    description: "Clocked in/out from the POS counter",
    Icon: Monitor,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
  },
  manual: {
    key: "manual",
    label: "Manual entry",
    shortLabel: "Manual",
    description: "Entered or adjusted by a manager",
    Icon: PenLine,
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    dotClass: "bg-amber-500",
  },
  biometric: {
    key: "biometric",
    label: "Biometric device",
    shortLabel: "Bio",
    description: "Fingerprint or face scan at entrance",
    Icon: Fingerprint,
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
    dotClass: "bg-violet-500",
  },
  mobile: {
    key: "mobile",
    label: "Captain mobile",
    shortLabel: "Mobile",
    description: "Punched from staff mobile app",
    Icon: Smartphone,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  correction: {
    key: "correction",
    label: "Correction",
    shortLabel: "Fix",
    description: "Approved attendance correction",
    Icon: Wrench,
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500",
  },
};

export function getAttendanceSource(source?: string | null): AttendanceSourceMeta {
  const key = (source ?? "manual").toLowerCase();
  return ATTENDANCE_SOURCES[key] ?? {
    key,
    label: key.replace(/_/g, " "),
    shortLabel: key.slice(0, 4).toUpperCase(),
    description: "Other punch channel",
    Icon: PenLine,
    badgeClass: "bg-gray-50 text-gray-700 border-gray-200",
    dotClass: "bg-gray-400",
  };
}

interface AttendanceSourceBadgeProps {
  source?: string | null;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function AttendanceSourceBadge({ source, size = "sm", showLabel = true }: AttendanceSourceBadgeProps) {
  const meta = getAttendanceSource(source);
  const Icon = meta.Icon;
  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const pad = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium capitalize ${meta.badgeClass} ${pad}`}
      title={meta.description}
    >
      <Icon className={iconSize} />
      {showLabel && meta.shortLabel}
    </span>
  );
}

export function AttendanceStatusChip({
  label,
  count,
  tone,
  icon,
}: {
  label: string;
  count: number;
  tone: "green" | "amber" | "gray" | "purple";
  icon: React.ReactNode;
}) {
  const tones = {
    green: "bg-green-50 text-green-800 border-green-200",
    amber: "bg-amber-50 text-amber-900 border-amber-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
    purple: "bg-violet-50 text-violet-800 border-violet-200",
  };

  return (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${tones[tone]}`}>
      <div className="opacity-80">{icon}</div>
      <div>
        <p className="text-lg font-bold leading-none">{count}</p>
        <p className="text-[11px] mt-0.5 opacity-80">{label}</p>
      </div>
    </div>
  );
}
