"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { PlatformNav } from "@/components/PlatformNav";

type ModuleCatalogRow = {
  moduleKey: string;
  label: string;
  planDefault: boolean;
  resolvedEnabled: boolean;
  effectiveState: string;
  override: { enabled: boolean } | null;
  features: Array<{
    featureKey: string;
    inheritedEnabled: boolean;
    resolvedEnabled: boolean;
    effectiveState: string;
    override: { state: string } | null;
  }>;
};

type TenantDetail = {
  organization: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    operatingMode: string;
    subscriptionPlan: string;
    configVersion: number;
    email?: string;
    phone?: string;
  };
  owner: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    lastLoginAt?: string;
  } | null;
  outlets: Array<{
    id: string;
    name: string;
    code: string;
    type: string;
    isActive: boolean;
    terminals: Array<{
      id: string;
      code: string;
      name: string;
      deviceType: string;
      isRegistered: boolean;
      revokedAt: string | null;
    }>;
  }>;
  capabilities: {
    configVersion: number;
    modules: Record<string, boolean>;
  };
  moduleCatalog: ModuleCatalogRow[];
  deviceHealth: {
    total: number;
    online: number;
    devices: Array<{
      terminalId: string | null;
      lastSeenAt: string;
      status: string;
      metadata: { appVersion?: string } | null;
    }>;
  };
  recentConfigAudits: Array<{
    id: string;
    metadata: { event?: string; target?: string; previousValue?: unknown; newValue?: unknown };
    createdAt: string;
    user: { email: string } | null;
  }>;
};

const MODES = ["SIMPLE", "STANDARD", "ADVANCED", "ENTERPRISE"] as const;
const FEATURE_STATES = ["DEFAULT", "ENABLED", "READ_ONLY", "DISABLED"] as const;

function moduleStateLabel(row: ModuleCatalogRow, plan: string) {
  if (row.override) {
    return row.override.enabled ? "Override: Enabled" : "Override: Disabled";
  }
  return row.planDefault
    ? `Inherited (Enabled by ${plan})`
    : `Inherited (Disabled by ${plan})`;
}

function featureStateLabel(row: ModuleCatalogRow["features"][number], plan: string) {
  if (row.override) {
    if (row.override.state === "ENABLED") return "Override: Enabled";
    if (row.override.state === "READ_ONLY") return "Override: Read-only";
    if (row.override.state === "DISABLED") return "Override: Disabled";
    return `Override: ${row.override.state}`;
  }
  return row.inheritedEnabled ? `Default (Enabled by ${plan})` : `Default (Disabled by ${plan})`;
}

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params.id as string;
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [mode, setMode] = useState("SIMPLE");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<TenantDetail>(`/platform/tenants/${tenantId}`);
      setTenant(data);
      setMode(data.organization.operatingMode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tenant");
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveMode() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await api<TenantDetail>(`/platform/tenants/${tenantId}/config`, {
        method: "PATCH",
        body: JSON.stringify({ operatingMode: mode }),
      });
      setTenant(updated);
      setMode(updated.organization.operatingMode);
      setMessage(`Operating mode saved. Config version is now v${updated.organization.configVersion}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function setModuleOverride(moduleKey: string, action: "enable" | "disable" | "inherit") {
    const label =
      action === "inherit" ? "remove override and inherit plan default" : `${action} module ${moduleKey}`;
    if (action === "disable" && !window.confirm(`Disable ${moduleKey}? Existing data will be kept.`)) {
      return;
    }
    if (action !== "disable" && action !== "inherit" && !window.confirm(`Confirm: ${label}?`)) {
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const moduleOverrides =
        action === "inherit"
          ? [{ moduleKey, inherit: true }]
          : [{ moduleKey, enabled: action === "enable" }];

      const updated = await api<TenantDetail>(`/platform/tenants/${tenantId}/config`, {
        method: "PATCH",
        body: JSON.stringify({ moduleOverrides }),
      });
      setTenant(updated);
      setMessage(
        action === "inherit"
          ? `${moduleKey} restored to inherited default (v${updated.organization.configVersion}).`
          : `${moduleKey} override saved (v${updated.organization.configVersion}).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Module update failed");
    } finally {
      setSaving(false);
    }
  }

  async function setFeatureOverride(
    featureKey: string,
    action: "inherit" | (typeof FEATURE_STATES)[number],
  ) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const featureOverrides =
        action === "inherit"
          ? [{ featureKey, inherit: true }]
          : [{ featureKey, state: action }];

      const updated = await api<TenantDetail>(`/platform/tenants/${tenantId}/config`, {
        method: "PATCH",
        body: JSON.stringify({ featureOverrides }),
      });
      setTenant(updated);
      setMessage(`Feature ${featureKey} updated (v${updated.organization.configVersion}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feature update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PlatformNav />
        <main className="p-6 max-w-5xl mx-auto text-gray-500">Loading tenant…</main>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PlatformNav />
        <main className="p-6 max-w-5xl mx-auto">
          <p className="text-red-600">{error ?? "Tenant not found"}</p>
          <Link href="/tenants" className="text-orange-600 hover:underline text-sm mt-4 inline-block">
            ← Back to tenants
          </Link>
        </main>
      </div>
    );
  }

  const org = tenant.organization;
  const plan = org.subscriptionPlan;

  return (
    <div className="min-h-screen bg-gray-50">
      <PlatformNav />
      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/tenants" className="text-sm text-orange-600 hover:underline">
            ← All tenants
          </Link>
          <h2 className="text-2xl font-bold mt-2">{org.name}</h2>
          <p className="text-gray-500">{org.slug}</p>
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        {message && (
          <p className="text-green-800 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">{message}</p>
        )}

        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h3 className="font-semibold text-gray-900">Overview</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Organization ID</dt>
              <dd className="font-mono text-xs break-all">{org.id}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd>{org.isActive ? "Active" : "Inactive"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Operating mode</dt>
              <dd>{org.operatingMode}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Subscription / profile</dt>
              <dd>{org.subscriptionPlan}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Config version</dt>
              <dd className="font-semibold">v{org.configVersion}</dd>
            </div>
          </dl>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h3 className="font-semibold text-gray-900">Owner</h3>
          {tenant.owner ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd>
                  {[tenant.owner.firstName, tenant.owner.lastName].filter(Boolean).join(" ")}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd>{tenant.owner.email}</dd>
              </div>
              {tenant.owner.lastLoginAt && (
                <div>
                  <dt className="text-gray-500">Last login</dt>
                  <dd>{new Date(tenant.owner.lastLoginAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-500">No owner account linked.</p>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h3 className="font-semibold text-gray-900">Outlets</h3>
          {tenant.outlets.length === 0 ? (
            <p className="text-sm text-gray-500">No outlets.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {tenant.outlets.map((outlet) => (
                <li key={outlet.id} className="py-2 flex justify-between gap-4">
                  <div>
                    <p className="font-medium">{outlet.name}</p>
                    <p className="text-xs text-gray-500">
                      {outlet.code} · {outlet.type} · {outlet.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Operating mode</h3>
          <p className="text-sm text-gray-500">Changes presentation metadata only; does not disable modules.</p>
          <div className="flex flex-wrap items-end gap-3">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              disabled={saving}
              className="border rounded-lg px-3 py-2 text-sm min-w-[160px]"
            >
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={saveMode}
              disabled={saving || mode === org.operatingMode}
              className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save mode"}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Product configuration — modules</h3>
          <p className="text-sm text-gray-500">
            Inherited modules follow the subscription plan. Overrides are stored only when explicitly changed.
          </p>
          <ul className="divide-y divide-gray-100">
            {tenant.moduleCatalog.map((row) => (
              <li key={row.moduleKey} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{row.label}</p>
                    <p className="text-xs text-gray-500 font-mono">{row.moduleKey}</p>
                    <p className="text-sm mt-1">
                      <span
                        className={
                          row.resolvedEnabled ? "text-green-700" : "text-red-700"
                        }
                      >
                        {row.resolvedEnabled ? "Resolved: Enabled" : "Resolved: Disabled"}
                      </span>
                      <span className="text-gray-400 mx-2">·</span>
                      <span className="text-gray-600">{moduleStateLabel(row, plan)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!row.override && !row.resolvedEnabled && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setModuleOverride(row.moduleKey, "enable")}
                        className="text-xs border rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Enable override
                      </button>
                    )}
                    {!row.override && row.resolvedEnabled && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setModuleOverride(row.moduleKey, "disable")}
                        className="text-xs border border-red-200 text-red-700 rounded px-2 py-1 hover:bg-red-50 disabled:opacity-50"
                      >
                        Disable
                      </button>
                    )}
                    {row.override && (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            setModuleOverride(
                              row.moduleKey,
                              row.override!.enabled ? "disable" : "enable",
                            )
                          }
                          className="text-xs border rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {row.override.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setModuleOverride(row.moduleKey, "inherit")}
                          className="text-xs border rounded px-2 py-1 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Remove override
                        </button>
                      </>
                    )}
                    {row.features.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedModule(expandedModule === row.moduleKey ? null : row.moduleKey)
                        }
                        className="text-xs text-orange-600 hover:underline"
                      >
                        {expandedModule === row.moduleKey ? "Hide features" : "Features"}
                      </button>
                    )}
                  </div>
                </div>

                {expandedModule === row.moduleKey && row.features.length > 0 && (
                  <ul className="mt-3 ml-2 pl-3 border-l border-gray-200 space-y-2">
                    {row.features.map((feature) => (
                      <li key={feature.featureKey} className="text-sm">
                        <p className="font-mono text-xs text-gray-700">{feature.featureKey}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {feature.resolvedEnabled ? "Resolved: on" : "Resolved: off"} ·{" "}
                          {featureStateLabel(feature, plan)}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <select
                            className="text-xs border rounded px-1 py-0.5"
                            defaultValue={feature.override?.state ?? "DEFAULT"}
                            disabled={saving}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "INHERIT") {
                                setFeatureOverride(feature.featureKey, "inherit");
                              } else {
                                setFeatureOverride(
                                  feature.featureKey,
                                  val as (typeof FEATURE_STATES)[number],
                                );
                              }
                            }}
                          >
                            <option value="INHERIT">Inherit default</option>
                            {FEATURE_STATES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h3 className="font-semibold text-gray-900">Devices</h3>
          {tenant.outlets.every((o) => o.terminals.length === 0) ? (
            <p className="text-sm text-gray-500">No registered terminals.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {tenant.outlets.flatMap((outlet) =>
                outlet.terminals.map((terminal) => {
                  const health = tenant.deviceHealth.devices.find(
                    (d) => d.terminalId === terminal.id,
                  );
                  const appVersion =
                    health?.metadata && typeof health.metadata === "object"
                      ? (health.metadata as { appVersion?: string }).appVersion
                      : undefined;
                  return (
                    <li key={terminal.id} className="py-2 flex justify-between gap-4">
                      <div>
                        <p className="font-medium">{terminal.code}</p>
                        <p className="text-xs text-gray-500">
                          {terminal.name} · {terminal.deviceType.toUpperCase()} · {outlet.name}
                        </p>
                        {health?.lastSeenAt && (
                          <p className="text-xs text-gray-400">
                            Last seen {new Date(health.lastSeenAt).toLocaleString()}
                            {appVersion ? ` · v${appVersion}` : ""}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-600 shrink-0">
                        {terminal.revokedAt
                          ? "Revoked"
                          : terminal.isRegistered
                            ? health?.status === "online"
                              ? "Online"
                              : "Registered"
                            : "Pending"}
                      </span>
                    </li>
                  );
                }),
              )}
            </ul>
          )}
          {tenant.deviceHealth.total > 0 && (
            <p className="text-xs text-gray-500 pt-2 border-t">
              Health records: {tenant.deviceHealth.online}/{tenant.deviceHealth.total} online
            </p>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h3 className="font-semibold text-gray-900">Configuration audit (recent)</h3>
          {tenant.recentConfigAudits.length === 0 ? (
            <p className="text-sm text-gray-500">No configuration changes logged yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm max-h-64 overflow-y-auto">
              {tenant.recentConfigAudits.map((entry) => (
                <li key={entry.id} className="py-2">
                  <p className="font-mono text-xs text-gray-800">
                    {(entry.metadata as { event?: string }).event ?? "platform_config"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.createdAt).toLocaleString()}
                    {entry.user?.email ? ` · ${entry.user.email}` : ""}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {(entry.metadata as { target?: string }).target}:{" "}
                    {JSON.stringify((entry.metadata as { previousValue?: unknown }).previousValue)} →{" "}
                    {JSON.stringify((entry.metadata as { newValue?: unknown }).newValue)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
