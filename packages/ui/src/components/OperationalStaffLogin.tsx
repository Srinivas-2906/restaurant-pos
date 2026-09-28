"use client";

import { useState } from "react";

export type EligibleStaffMember = {
  id: string;
  displayName: string;
  employeeCode: string;
  profilePhotoUrl: string | null;
};

type Accent = "orange" | "teal" | "amber";

const accentClasses: Record<
  Accent,
  { card: string; avatar: string; link: string; dot: string; button: string }
> = {
  orange: {
    card: "hover:border-orange-500/60",
    avatar: "bg-orange-500/20 text-orange-300",
    link: "hover:text-orange-400",
    dot: "bg-orange-500",
    button: "bg-orange-600 hover:bg-orange-500",
  },
  teal: {
    card: "hover:border-teal-500/60",
    avatar: "bg-teal-500/20 text-teal-300",
    link: "hover:text-teal-400",
    dot: "bg-teal-500",
    button: "bg-teal-600 hover:bg-teal-500",
  },
  amber: {
    card: "hover:border-amber-500/60",
    avatar: "bg-amber-500/20 text-amber-300",
    link: "hover:text-amber-400",
    dot: "bg-amber-500",
    button: "bg-amber-600 hover:bg-amber-500",
  },
};

export function OperationalStaffPicker({
  staff,
  loading,
  accent = "orange",
  onSelect,
  onManagerSignIn,
}: {
  staff: EligibleStaffMember[];
  loading?: boolean;
  accent?: Accent;
  onSelect: (member: EligibleStaffMember) => void;
  onManagerSignIn: () => void;
}) {
  const colors = accentClasses[accent];

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white">Who&apos;s signing in?</h1>
        <p className="text-white/50 mt-1">Select your name, then enter your PIN</p>
      </div>

      {loading ? (
        <p className="text-center text-white/50">Loading staff…</p>
      ) : staff.length === 0 ? (
        <p className="text-center text-white/50">
          No PIN-enabled staff for this device. Ask a manager to set up employee PINs.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {staff.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(member)}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors ${colors.card}`}
            >
              <div
                className={`h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold ${colors.avatar}`}
              >
                {member.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">{member.displayName}</p>
                <p className="text-xs text-white/40">{member.employeeCode}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={onManagerSignIn}
          className={`text-sm text-white/50 underline-offset-2 hover:underline transition-colors ${colors.link}`}
        >
          Manager sign in (email)
        </button>
      </div>
    </div>
  );
}

export function OperationalPinPad({
  staffName,
  accent = "orange",
  submitLabel = "Unlock",
  onSubmit,
  onBack,
  error,
  submitting,
}: {
  staffName: string;
  accent?: Accent;
  submitLabel?: string;
  onSubmit: (pin: string) => Promise<void>;
  onBack: () => void;
  error?: string | null;
  submitting?: boolean;
}) {
  const colors = accentClasses[accent];
  const [pin, setPin] = useState("");
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

  function press(key: string) {
    if (submitting) return;
    if (key === "clear") {
      setPin("");
      return;
    }
    if (key === "back") {
      setPin((value) => value.slice(0, -1));
      return;
    }
    if (pin.length >= 6) return;
    setPin((value) => value + key);
  }

  async function submit() {
    if (pin.length < 4 || submitting) return;
    await onSubmit(pin);
  }

  return (
    <div className="w-full max-w-sm mx-auto p-6 sm:p-8 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
      <button type="button" onClick={onBack} className="text-sm text-white/50 hover:text-white mb-4 transition-colors">
        ← Back
      </button>
      <h2 className="text-xl font-bold text-white text-center">{staffName}</h2>
      <p className="text-center text-white/50 text-sm mt-1 mb-6">Enter your PIN</p>

      <div className="flex justify-center gap-2 mb-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            key={index}
            className={`h-3 w-3 rounded-full ${index < pin.length ? colors.dot : "bg-white/20"}`}
          />
        ))}
      </div>

      {error && <p className="text-center text-sm text-red-400 mb-4">{error}</p>}

      <div className="grid grid-cols-3 gap-2 mb-4">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className="py-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-lg transition-colors"
          >
            {key === "clear" ? "C" : key === "back" ? "⌫" : key}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={pin.length < 4 || submitting}
        onClick={submit}
        className={`w-full py-4 rounded-xl disabled:opacity-50 font-bold text-lg text-white transition-colors ${colors.button}`}
      >
        {submitting ? "Signing in…" : submitLabel}
      </button>
    </div>
  );
}
