"use client";

import { useState } from "react";
import { StaffLoginForm } from "@kaana/ui";
import {
  clearTerminalCredential,
  fetchTerminalMe,
  login,
  registerTerminal,
  setSelectedOutletId,
  setTerminalCredential,
} from "@/lib/api";

const DEMO_TERMINAL_SECRET = "kaana-demo-terminal-secret";

type TerminalOption = {
  id: string;
  name: string;
  code: string;
  deviceType?: string;
  isRegistered?: boolean;
  isActive?: boolean;
};

function getOutletIdFromUser(user: { roles?: Array<{ outletId?: string | null }> }) {
  return user.roles?.find((r) => r.outletId)?.outletId ?? user.roles?.[0]?.outletId ?? null;
}

export function CaptainTerminalSetup({ onRegistered }: { onRegistered: () => void }) {
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
      setError(err instanceof Error ? err.message : "Could not connect this captain device");
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
      throw new Error("Use a manager account to connect this captain tablet.");
    }

    const resolvedOutletId = getOutletIdFromUser(data.user);
    if (!resolvedOutletId) {
      throw new Error("No outlet assigned to this account.");
    }

    setSelectedOutletId(resolvedOutletId);

    const outlet = await loginFetchOutlet(resolvedOutletId, data.accessToken);
    const list = (outlet.terminals ?? []).filter(
      (t) => t.isActive !== false && t.deviceType === "captain",
    );
    if (list.length === 0) {
      throw new Error("No captain device configured for this outlet yet.");
    }

    await connectTerminal(list[0]);
  }

  return (
    <div className="space-y-4 w-full max-w-md">
      <StaffLoginForm
        layout="card"
        appName="Kaana Kitchens Captain"
        badge="Device setup"
        tagline="One-time manager sign-in to connect this captain tablet"
        hint="After setup, captains pick their name and enter a PIN."
        defaultEmail="manager@kaanafoods.in"
        accent="teal"
        onSubmit={handleManagerLogin}
      />
      {connecting && <p className="text-center text-sm text-teal-300">Connecting device…</p>}
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
