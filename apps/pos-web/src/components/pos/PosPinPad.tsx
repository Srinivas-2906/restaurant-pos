"use client";

import { useState } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

export function PosPinPad({
  staffName,
  onSubmit,
  onBack,
  error,
  submitting,
}: {
  staffName: string;
  onSubmit: (pin: string) => Promise<void>;
  onBack: () => void;
  error?: string | null;
  submitting?: boolean;
}) {
  const [pin, setPin] = useState("");

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
    <div className="w-full max-w-sm mx-auto p-8 bg-gray-800 rounded-2xl border border-gray-700">
      <button type="button" onClick={onBack} className="text-sm text-gray-400 hover:text-white mb-4">
        ← Back
      </button>
      <h2 className="text-xl font-bold text-white text-center">{staffName}</h2>
      <p className="text-center text-gray-400 text-sm mt-1 mb-6">Enter your PIN</p>

      <div className="flex justify-center gap-2 mb-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            key={index}
            className={`h-3 w-3 rounded-full ${
              index < pin.length ? "bg-orange-500" : "bg-gray-600"
            }`}
          />
        ))}
      </div>

      {error && <p className="text-center text-sm text-red-400 mb-4">{error}</p>}

      <div className="grid grid-cols-3 gap-2 mb-4">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => (key === "clear" || key === "back" ? press(key) : press(key))}
            className="py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-semibold text-lg"
          >
            {key === "clear" ? "C" : key === "back" ? "⌫" : key}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={pin.length < 4 || submitting}
        onClick={submit}
        className="w-full py-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 font-bold text-lg text-white"
      >
        {submitting ? "Signing in…" : "Unlock POS"}
      </button>
    </div>
  );
}
