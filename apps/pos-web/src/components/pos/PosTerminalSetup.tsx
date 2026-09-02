"use client";

import { useState } from "react";
import { StaffLoginForm } from "@kaana/ui";
import { resolvePrimaryRole, usesPosApp } from "@kaana/role-shells";
import { api, login, registerTerminal, setSelectedOutletId, setTerminalCredential } from "@/lib/api";

type TerminalOption = {
  id: string;
  name: string;
  code: string;
};

function getOutletIdFromUser(user: { roles?: Array<{ outletId?: string | null }> }) {
  return user.roles?.find((r) => r.outletId)?.outletId ?? user.roles?.[0]?.outletId ?? null;
}

export function PosTerminalSetup({ onRegistered }: { onRegistered: () => void }) {
  const [step, setStep] = useState<"login" | "pick-terminal">("login");
  const [outletId, setOutletId] = useState<string | null>(null);
  const [terminals, setTerminals] = useState<TerminalOption[]>([]);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleManagerLogin(email: string, password: string) {
    setError(null);
    const data = await login(email, password);
    const role = resolvePrimaryRole(data.user);
    const canRegister = usesPosApp(role) || role === "owner" || role === "manager";
    if (!canRegister) {
      throw new Error("Only managers or POS staff can register this terminal.");
    }

    const resolvedOutletId = getOutletIdFromUser(data.user);
    if (!resolvedOutletId) {
      throw new Error("No outlet assigned to this account.");
    }

    setOutletId(resolvedOutletId);
    setSelectedOutletId(resolvedOutletId);

    const outlet = await api<{ terminals?: TerminalOption[] }>(`/outlets/${resolvedOutletId}`);
    const list = outlet.terminals ?? [];
    if (list.length === 0) {
      throw new Error("No terminals configured for this outlet. Create one in Operations first.");
    }
    setTerminals(list);
    setStep("pick-terminal");
  }

  async function handleRegister(terminalId: string) {
    setRegisteringId(terminalId);
    setError(null);
    try {
      const result = await registerTerminal(terminalId);
      setTerminalCredential(result.terminal.id, result.deviceSecret);
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegisteringId(null);
    }
  }

  if (step === "login") {
    return (
      <div className="space-y-4">
        <StaffLoginForm
          appName="Kaana Kitchens POS"
          badge="Terminal setup"
          tagline="Manager sign-in required once to register this device"
          hint="Use your manager account to bind this browser to a POS terminal."
          defaultEmail="manager@kaanafoods.in"
          accent="orange"
          onSubmit={handleManagerLogin}
        />
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto p-8 bg-gray-800 rounded-2xl border border-gray-700">
      <h2 className="text-xl font-bold text-white mb-2">Register this terminal</h2>
      <p className="text-sm text-gray-400 mb-6">
        Choose the counter this device represents. A one-time device secret will be stored locally.
      </p>
      <div className="space-y-2">
        {terminals.map((terminal) => (
          <button
            key={terminal.id}
            type="button"
            disabled={registeringId !== null}
            onClick={() => handleRegister(terminal.id)}
            className="w-full text-left px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            <p className="font-medium text-white">{terminal.name}</p>
            <p className="text-xs text-gray-400">Code {terminal.code}</p>
          </button>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      {registeringId && (
        <p className="mt-4 text-sm text-orange-300">Registering terminal…</p>
      )}
    </div>
  );
}
