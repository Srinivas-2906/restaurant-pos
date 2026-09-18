"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DisabledFeatureRoute } from "@kaana/ui";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, loadOrganizationOutlets, type OutletSummary } from "@/lib/api";
import { useCapabilities } from "@/contexts/CapabilitiesContext";

type TerminalRow = {
  id: string;
  name: string;
  code: string;
  deviceType: string;
  outletId: string;
  outlet: { id: string; name: string; code: string };
  isActive: boolean;
  isRegistered: boolean;
  revokedAt: string | null;
  registeredAt: string | null;
  hasPendingActivationCode: boolean;
  activationCodeExpiresAt: string | null;
  status: string;
  lastSeenAt: string | null;
  appVersion: string | null;
  healthStatus: string;
};

type ActivationPayload = {
  terminalId: string;
  activationCode: string;
  activationCodeDisplay: string;
  expiresAt: string;
};

const DEVICE_TYPES = [
  { value: "pos", label: "POS" },
  { value: "kds", label: "KDS" },
  { value: "captain", label: "Captain" },
] as const;

function statusLabel(status: string) {
  switch (status) {
    case "online":
      return "Online";
    case "offline":
      return "Recently seen";
    case "waiting_activation":
      return "Waiting for activation";
    case "revoked":
      return "Revoked";
    case "active":
      return "Active";
    default:
      return status;
  }
}

function statusClass(status: string) {
  if (status === "online" || status === "active") return "text-green-700 bg-green-50";
  if (status === "waiting_activation") return "text-amber-700 bg-amber-50";
  if (status === "revoked") return "text-red-700 bg-red-50";
  return "text-gray-600 bg-gray-100";
}

export function DevicesModule() {
  const { capabilities, ready } = useCapabilities();
  const [terminals, setTerminals] = useState<TerminalRow[]>([]);
  const [outlets, setOutlets] = useState<OutletSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activation, setActivation] = useState<ActivationPayload | null>(null);
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    outletId: "",
    deviceType: "pos" as "pos" | "kds" | "captain",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [terminalRows, outletRows] = await Promise.all([
        api<TerminalRow[]>("/terminals"),
        loadOrganizationOutlets(),
      ]);
      setTerminals(terminalRows);
      setOutlets(outletRows);
      if (!form.outletId && outletRows[0]) {
        setForm((prev) => ({ ...prev, outletId: outletRows[0].id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  }, [form.outletId]);

  useEffect(() => {
    if (ready && capabilities?.modules.devices !== false) {
      load();
    } else if (ready) {
      setLoading(false);
    }
  }, [load, ready, capabilities?.modules.devices]);

  const selectedTerminal = useMemo(
    () => terminals.find((row) => row.id === selectedTerminalId) ?? null,
    [terminals, selectedTerminalId],
  );

  async function createDevice(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const created = await api<TerminalRow>("/terminals", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({ name: "", outletId: form.outletId, deviceType: "pos" });
      setSelectedTerminalId(created.id);
      setMessage(`Device "${created.name}" created. Generate an activation code to pair the physical device.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create device");
    } finally {
      setSaving(false);
    }
  }

  async function generateCode(terminalId: string) {
    setSaving(true);
    setError(null);
    try {
      const payload = await api<ActivationPayload>(`/terminals/${terminalId}/activation-code`, {
        method: "POST",
      });
      setActivation(payload);
      setSelectedTerminalId(terminalId);
      setMessage(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate activation code");
    } finally {
      setSaving(false);
    }
  }

  async function cancelCode(terminalId: string) {
    setSaving(true);
    setError(null);
    try {
      await api(`/terminals/${terminalId}/cancel-activation-code`, { method: "POST" });
      if (activation?.terminalId === terminalId) setActivation(null);
      setMessage("Activation code cancelled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel activation code");
    } finally {
      setSaving(false);
    }
  }

  async function revokeDevice(terminalId: string, name: string) {
    if (!window.confirm(`Revoke "${name}"? The device will no longer authenticate.`)) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/terminals/${terminalId}/revoke`, { method: "POST" });
      if (activation?.terminalId === terminalId) setActivation(null);
      setMessage(`"${name}" revoked. Generate a new activation code to reactivate.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke device");
    } finally {
      setSaving(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("Activation code copied.");
    } catch {
      setMessage("Copy failed — select the code manually.");
    }
  }

  if (ready && capabilities?.modules.devices === false) {
    return (
      <DisabledFeatureRoute
        featureLabel="Device management"
        reason="Device management is not enabled for your restaurant."
      />
    );
  }

  return (
    <PageContent>
      <PageHeader
        title="Devices"
        description="Register POS counters, kitchen screens, and captain devices for your outlets."
        action={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-kaana text-white px-4 py-2 text-sm font-medium"
          >
            Add device
          </button>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-4 text-sm text-green-700">{message}</p>}

      {showForm && (
        <Panel title="Add device" className="mb-6">
          <form onSubmit={createDevice} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Billing Counter 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Outlet</label>
              <select
                required
                value={form.outletId}
                onChange={(e) => setForm((prev) => ({ ...prev, outletId: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {outlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name} ({outlet.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device mode</label>
              <select
                value={form.deviceType}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, deviceType: e.target.value as typeof form.deviceType }))
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {DEVICE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create device"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}

      {activation && selectedTerminal && (
        <Panel title="Activation code" className="mb-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
            <div>
              <dt className="text-gray-500">Device</dt>
              <dd className="font-medium">{selectedTerminal.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Mode</dt>
              <dd className="font-medium uppercase">{selectedTerminal.deviceType}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Activation code</dt>
              <dd className="font-mono text-lg tracking-widest">{activation.activationCodeDisplay}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Expires</dt>
              <dd>{new Date(activation.expiresAt).toLocaleString()}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyCode(activation.activationCodeDisplay)}
              className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm"
            >
              Copy code
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => generateCode(activation.terminalId)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Regenerate
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => cancelCode(activation.terminalId)}
              className="rounded-lg border border-red-200 text-red-700 px-4 py-2 text-sm"
            >
              Cancel code
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Enter this code once on the physical device. Device secrets are never shown here.
          </p>
        </Panel>
      )}

      <Panel title="Restaurant devices">
        {loading ? (
          <p className="text-sm text-gray-500">Loading devices…</p>
        ) : terminals.length === 0 ? (
          <EmptyState title="No devices yet" description="Add a POS, KDS, or Captain device to get started." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {terminals.map((terminal) => (
              <li key={terminal.id} className="py-4 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{terminal.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(terminal.status)}`}>
                      {statusLabel(terminal.status)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 font-mono">{terminal.id}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {terminal.outlet.name} · {terminal.code} · {terminal.deviceType.toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {terminal.lastSeenAt
                      ? `Last seen ${new Date(terminal.lastSeenAt).toLocaleString()}`
                      : "No heartbeat yet"}
                    {terminal.appVersion ? ` · App ${terminal.appVersion}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!terminal.isRegistered || terminal.revokedAt ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => generateCode(terminal.id)}
                      className="text-sm rounded-lg border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Generate activation code
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => generateCode(terminal.id)}
                        className="text-sm rounded-lg border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Re-pair
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => revokeDevice(terminal.id, terminal.name)}
                        className="text-sm rounded-lg border border-red-200 text-red-700 px-3 py-1.5 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}
