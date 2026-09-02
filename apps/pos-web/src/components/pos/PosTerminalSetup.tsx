"use client";

import { useState } from "react";
import { StaffLoginForm } from "@kaana/ui";
import { login, registerTerminal, setSelectedOutletId, setTerminalCredential, fetchTerminalMe, clearTerminalCredential } from "@/lib/api";

/** Matches seed demo terminal secret — used to reconnect without re-registering. */
const DEMO_TERMINAL_SECRET = "kaana-demo-terminal-secret";

type TerminalOption = {
  id: string;
  name: string;
  code: string;
  isRegistered?: boolean;
  isActive?: boolean;
  isMaster?: boolean;
};

function getOutletIdFromUser(user: { roles?: Array<{ outletId?: string | null }> }) {
  return user.roles?.find((r) => r.outletId)?.outletId ?? user.roles?.[0]?.outletId ?? null;
}

export function PosTerminalSetup({ onRegistered }: { onRegistered: () => void }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connectTerminal(terminal: TerminalOption) {
    setConnecting(true);
    setError(null);
    try {
      if (terminal.isRegistered) {
        setTerminalCredential(terminal.id, DEMO_TERMINAL_SECRET);
        try {
          await fetchTerminalMe();
          onRegistered();
          return;
        } catch {
          clearTerminalCredential();
        }
      }

      const result = await registerTerminal(terminal.id);
      setTerminalCredential(result.terminal.id, result.deviceSecret);
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect this counter");
    } finally {
      setConnecting(false);
    }
  }

  async function handleManagerLogin(email: string, password: string) {
    setError(null);
    const data = await login(email, password);
    const roles = data.user.roles?.map((r) => r.role) ?? [];
    const canRegister = roles.includes("manager") || roles.includes("owner");
    if (!canRegister) {
      throw new Error(
        "Use a manager account (manager@kaanafoods.in) to connect this counter. Cashiers sign in with PIN after setup.",
      );
    }

    const resolvedOutletId = getOutletIdFromUser(data.user);
    if (!resolvedOutletId) {
      throw new Error("No outlet assigned to this account.");
    }

    setSelectedOutletId(resolvedOutletId);

    const outlet = await loginFetchOutlet(resolvedOutletId, data.accessToken);
    const list = (outlet.terminals ?? []).filter((t) => t.isActive !== false);
    if (list.length === 0) {
      throw new Error("No POS counter configured for this outlet yet.");
    }

    const counter = list.find((t) => t.isMaster) ?? list[0];
    await connectTerminal(counter);
  }

  return (
    <div className="space-y-4 w-full max-w-md">
      <StaffLoginForm
        appName="Kaana Kitchens POS"
        badge="Counter setup"
        tagline="One-time manager sign-in to connect this device"
        hint="After setup, staff pick their name and enter a PIN. Full restaurant onboarding comes later."
        defaultEmail="manager@kaanafoods.in"
        accent="orange"
        onSubmit={handleManagerLogin}
      />
      {connecting && (
        <p className="text-center text-sm text-orange-300">Connecting counter…</p>
      )}
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}

async function loginFetchOutlet(
  outletId: string,
  token: string,
): Promise<{ terminals?: TerminalOption[] }> {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
  const base = raw.endsWith("/api") ? raw : `${raw}/api`;
  const res = await fetch(`${base}/outlets/${outletId}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.message || err.error || "Could not load outlet");
  }
  return res.json();
}
