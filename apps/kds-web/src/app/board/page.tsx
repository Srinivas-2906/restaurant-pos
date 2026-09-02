"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import { groupKotsByTable, notify, notifyOrderUpdate, type KdsQueueItem, type TableKOTGroup } from "@kaana/ui";
import { KdsFloor } from "@/components/KdsFloor";
import { KdsTableDetail } from "@/components/KdsTableDetail";
import { RoleAppShell } from "@/components/RoleAppShell";
import {
  api,
  loadOutletName,
  logout,
  resolveDefaultOutletId,
  WS_URL,
} from "@/lib/api";

function KDSApp() {
  const [kots, setKots] = useState<KdsQueueItem[]>([]);
  const [ready, setReady] = useState(false);
  const [outletId, setOutletId] = useState("");
  const [outletName, setOutletName] = useState("");
  const [loadError, setLoadError] = useState("");
  const [bumpingId, setBumpingId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<TableKOTGroup | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const tableGroups = useMemo(() => groupKotsByTable(kots), [kots]);

  const loadKots = useCallback(async () => {
    if (!outletId) return;
    try {
      setLoadError("");
      const data = await api<KdsQueueItem[]>(`/kds/outlets/${outletId}/queue`);
      setKots(data);
      setLastUpdated(new Date());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load tickets";
      setLoadError(msg);
      notify.error(msg);
      setKots([]);
    }
  }, [outletId]);

  useEffect(() => {
    async function init() {
      try {
        const oid = await resolveDefaultOutletId();
        if (!oid) {
          setReady(true);
          return;
        }
        setOutletId(oid);
        localStorage.setItem("kdsOutletId", oid);
        const name = await loadOutletName(oid);
        setOutletName(name);
        setReady(true);
      } catch (e) {
        console.error(e);
        setReady(true);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!ready || !outletId) return;
    loadKots();

    const socket = io(WS_URL);
    socket.emit("join", { channel: `outlet:${outletId}:orders` });
    socket.on("order:update", (event: { type?: string; tableNumber?: string | null; itemNames?: string[]; kotNumber?: string; stationName?: string }) => {
      if (event?.type) notifyOrderUpdate(event, "kds");
      loadKots();
    });

    const interval = setInterval(loadKots, 5000);
    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [ready, outletId, loadKots]);

  useEffect(() => {
    if (!selectedGroup) return;
    const updated = tableGroups.find((g) => g.tableKey === selectedGroup.tableKey);
    if (updated) setSelectedGroup(updated);
    else setSelectedGroup(null);
  }, [tableGroups, selectedGroup?.tableKey]);

  async function bump(kotId: string, action: "preparing" | "ready") {
    setBumpingId(kotId);
    try {
      await api(`/kds/kot/${kotId}/${action}`, { method: "PATCH" });
      if (action === "ready") notify.success("Ticket marked ready");
      else notify.info("Prep started");
    } catch {
      notify.error("Could not update ticket");
    }
    setTimeout(() => {
      setBumpingId(null);
      loadKots();
    }, 280);
  }

  if (!ready) {
    return <div className="h-screen flex items-center justify-center bg-surface text-slate-500">Loading kitchen…</div>;
  }

  if (!outletId) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface text-slate-500">
        No outlet configured for this kitchen display.
      </div>
    );
  }

  const stats = (
    <>
      <span className="font-semibold text-white">{tableGroups.length}</span> tables
      <span className="mx-2 text-white/30">·</span>
      <span className="font-semibold text-white">{kots.length}</span> tickets
      {lastUpdated && (
        <>
          <span className="mx-2 text-white/30">·</span>
          <span className="text-xs">{lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
        </>
      )}
      {loadError && <span className="ml-3 text-red-300 text-xs">{loadError}</span>}
      <button
        type="button"
        onClick={() => {
          logout();
          window.location.href = "/";
        }}
        className="ml-4 text-white/60 hover:text-white text-xs border border-white/20 rounded-lg px-2 py-1"
      >
        Sign out
      </button>
    </>
  );

  return (
    <RoleAppShell
      variant="kds"
      title="Kitchen Display"
      badge="Kitchen"
      subtitle={outletName}
      trailing={stats}
      hint={!selectedGroup ? "Production queue — tap a table to bump tickets ready for the floor." : undefined}
    >
      {!selectedGroup ? (
        <div className="p-5">
          <KdsFloor groups={tableGroups} onSelectTable={setSelectedGroup} />
        </div>
      ) : (
        <KdsTableDetail
          group={selectedGroup}
          bumpingId={bumpingId}
          onBack={() => setSelectedGroup(null)}
          onStartPrep={(id) => bump(id, "preparing")}
          onMarkReady={(id) => bump(id, "ready")}
        />
      )}
    </RoleAppShell>
  );
}

export default function KDSBoardPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-surface">Loading…</div>}>
      <KDSApp />
    </Suspense>
  );
}
