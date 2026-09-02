"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Loader2, Users } from "lucide-react";
import { notify } from "@kaana/ui";
import { buildReservationsLink, readAuthHandoffFromStorage } from "@kaana/role-shells";
import { api, getOutletId, getUser } from "@/lib/api";

interface Reservation {
  id: string;
  guestName: string;
  guestPhone: string;
  guestCount: number;
  date: string;
  status: string;
  tableId?: string | null;
  table?: { number: string } | null;
}

function minsUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

function formatCountdown(mins: number) {
  if (mins < 0) return "Overdue";
  if (mins < 1) return "Now";
  if (mins < 60) return `In ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `In ${h}h ${m}m` : `In ${h}h`;
}

export function PosReservationPanel({
  onRefreshFloor,
  onOpenOrder,
  selectedReservationId,
  onSelectReservation,
}: {
  onRefreshFloor: () => void;
  onOpenOrder: (reservationId: string, tableId: string, orderId: string) => void;
  selectedReservationId?: string | null;
  onSelectReservation: (id: string | null) => void;
}) {
  const outletId = getOutletId() || "";
  const user = getUser();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    if (!outletId) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const data = await api<Reservation[]>(`/reservations?outletId=${outletId}&date=${today}`);
      setReservations(data.filter((r) => !["cancelled", "no_show", "completed"].includes(r.status)));
    } catch {
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = useMemo(
    () =>
      reservations
        .filter((r) => ["confirmed", "arrived"].includes(r.status))
        .filter((r) => minsUntil(r.date) <= 60)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5),
    [reservations],
  );

  const arrived = useMemo(
    () => reservations.filter((r) => r.status === "arrived"),
    [reservations],
  );

  const selected = reservations.find((r) => r.id === selectedReservationId);

  async function act(path: string, body?: unknown) {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api<{ reservation?: Reservation; order?: { id: string } }>(
        `/reservations/${selected.id}${path}`,
        { method: "PATCH", ...(body ? { body: JSON.stringify(body) } : {}) },
      );
      notify.success("Updated");
      await load();
      onRefreshFloor();
      if (path === "/open-order" && result.order) {
        const tableId = result.reservation?.tableId ?? selected.tableId;
        if (tableId) {
          onOpenOrder(selected.id, tableId, result.order.id);
          onSelectReservation(null);
        }
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function openFullApp() {
    const handoff = readAuthHandoffFromStorage();
    if (!handoff) return;
    window.open(buildReservationsLink("/", { ...handoff, outletId }), "_blank");
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-20 bg-violet-600 text-white px-2 py-4 rounded-l-xl shadow-lg text-xs font-bold writing-mode-vertical"
        style={{ writingMode: "vertical-rl" }}
      >
        Reservations
      </button>
    );
  }

  return (
    <aside className="w-full lg:w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col max-h-[calc(100vh-120px)] lg:max-h-none">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm text-slate-900">Reservations</p>
          <p className="text-[11px] text-slate-500">Service-time only</p>
        </div>
        <button type="button" onClick={() => setCollapsed(true)} className="text-xs text-slate-400 hover:text-slate-600 lg:hidden">
          Hide
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
          </div>
        ) : (
          <>
            <section>
              <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Next up</p>
              {upcoming.length === 0 ? (
                <p className="text-xs text-slate-400">No bookings in the next hour</p>
              ) : (
                <div className="space-y-2">
                  {upcoming.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onSelectReservation(r.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-sm transition-colors ${
                        selectedReservationId === r.id ? "border-violet-400 bg-violet-50" : "border-slate-100 hover:bg-slate-50"
                      }`}
                    >
                      <p className="font-semibold text-slate-900 truncate">{r.guestName}</p>
                      <p className="text-xs text-slate-600">
                        {formatCountdown(minsUntil(r.date))} · {r.guestCount} guests
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {arrived.length > 0 && (
              <section>
                <p className="text-[10px] font-bold uppercase text-emerald-700 mb-2">Arrived</p>
                <div className="space-y-2">
                  {arrived.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onSelectReservation(r.id)}
                      className="w-full text-left p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-sm"
                    >
                      <p className="font-semibold">{r.guestName}</p>
                      <p className="text-xs text-emerald-800">Awaiting table · {r.guestCount} guests</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {selected && (
              <section className="p-3 rounded-xl bg-violet-50 border border-violet-200 space-y-2">
                <p className="font-semibold text-sm">{selected.guestName}</p>
                <p className="text-xs text-slate-600 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {selected.guestCount} · {selected.guestPhone}
                </p>
                <p className="text-[10px] uppercase font-bold text-violet-700">{selected.status.replace("_", " ")}</p>
                <div className="flex flex-col gap-1.5 pt-1">
                  {selected.status === "confirmed" && (
                    <button type="button" disabled={busy} onClick={() => act("/check-in")} className="pos-btn-primary !bg-sky-600 !text-xs !py-2">
                      Check in
                    </button>
                  )}
                  {selected.tableId && !["cancelled", "completed"].includes(selected.status) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        act("/open-order", { createdById: user?.id, terminalId: undefined })
                      }
                      className="pos-btn-primary !text-xs !py-2"
                    >
                      Open order {selected.table ? `(T${selected.table.number})` : ""}
                    </button>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <div className="p-3 border-t border-slate-100">
        <button
          type="button"
          onClick={openFullApp}
          className="w-full flex items-center justify-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900 py-2"
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Open Reservations app
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}

// expose load for parent refresh — removed static hack
