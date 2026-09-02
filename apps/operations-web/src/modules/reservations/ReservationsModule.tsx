"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Map as MapIcon,
  Plus,
  Users,
  X,
} from "lucide-react";
import { notify } from "@kaana/ui";
import { api, ensureOutletSelected, formatDate, formatTime, getOutletId, STATUS_COLORS } from "@/lib/api";
import { isOnLocalDay, localDateIso } from "@/modules/reservations/dates";
import type { FloorPlan, Reservation, TabId, WaitlistEntry } from "@/modules/reservations/types";
import { useReservationsRealtime } from "@/hooks/useReservationsRealtime";
import { ReservationDrawer } from "@/modules/reservations/ReservationDrawer";
import { FloorView } from "@/modules/reservations/FloorView";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { OutletSelector } from "@/components/OutletSelector";

const TABS: { id: TabId; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "today", label: "Today" },
  { id: "calendar", label: "Calendar" },
  { id: "waitlist", label: "Waitlist" },
  { id: "cancelled", label: "Cancelled / No-show" },
  { id: "floor", label: "Floor" },
];

function ReservationCard({
  r,
  onAction,
  tables,
}: {
  r: Reservation;
  onAction: () => void;
  tables?: FloorPlan["tables"];
}) {
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    try {
      await api(`/reservations/${r.id}${path}`, {
        method: "PATCH",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      notify.success("Updated");
      onAction();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
      setAssignOpen(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-card ring-1 ring-black/[0.04] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-slate-900">{r.guestName}</p>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? "bg-slate-100"}`}>
            {r.status.replace("_", " ")}
          </span>
          <span className="text-[10px] text-slate-500 uppercase">{r.source.replace("_", " ")}</span>
        </div>
        <p className="text-sm text-slate-600 mt-0.5">
          {formatTime(r.date)} · {r.guestCount} guests · {r.guestPhone}
        </p>
        {r.table && (
          <p className="text-xs text-violet-700 mt-1">Table {r.table.number}{r.table.name ? ` (${r.table.name})` : ""}</p>
        )}
        {r.occasion && <p className="text-xs text-slate-500 mt-0.5">{r.occasion}</p>}
        {r.specialRequest && <p className="text-xs text-slate-500 italic mt-0.5">{r.specialRequest}</p>}
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        {r.status === "confirmed" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => act("/check-in")}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Check in
          </button>
        )}
        {["confirmed", "arrived"].includes(r.status) && !r.order && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setAssignOpen(!assignOpen)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Assign table
          </button>
        )}
        {r.tableId && !r.order && ["confirmed", "arrived", "seated"].includes(r.status) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => act("/open-order", {})}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Open order
          </button>
        )}
        {!["cancelled", "completed", "no_show"].includes(r.status) && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => act("/cancel")}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Cancel
            </button>
            {r.status === "confirmed" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => act("/no-show")}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-orange-200 text-orange-700 hover:bg-orange-50 disabled:opacity-50"
              >
                No-show
              </button>
            )}
          </>
        )}
      </div>
      {assignOpen && tables && (
        <div className="w-full flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          {tables.filter((t) => t.status === "free" || t.id === r.tableId).map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={busy}
              onClick={() => act("/assign-table", { tableId: t.id })}
              className="px-2 py-1 text-xs rounded-lg bg-slate-100 hover:bg-violet-100"
            >
              T{t.number} ({t.capacity})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WaitlistPanel({ outletId, onRefresh }: { outletId: string; onRefresh: () => void }) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ guestName: "", guestPhone: "", guestCount: 2, quotedWaitMins: 15 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<WaitlistEntry[]>(`/waitlist?outletId=${outletId}`);
      setEntries(data);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Failed to load waitlist");
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/waitlist", {
        method: "POST",
        body: JSON.stringify({ outletId, ...form, guestCount: Number(form.guestCount), quotedWaitMins: Number(form.quotedWaitMins) }),
      });
      notify.success("Added to waitlist");
      setForm({ guestName: "", guestPhone: "", guestCount: 2, quotedWaitMins: 15 });
      load();
      onRefresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed");
    }
  }

  async function entryAction(id: string, action: "notify" | "promote" | "cancel") {
    try {
      await api(`/waitlist/${id}/${action}`, { method: "PATCH", ...(action === "promote" ? { body: JSON.stringify({}) } : {}) });
      notify.success("Updated");
      load();
      onRefresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addEntry} className="bg-white rounded-xl shadow-card p-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          required
          placeholder="Guest name"
          value={form.guestName}
          onChange={(e) => setForm({ ...form, guestName: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="Phone"
          value={form.guestPhone}
          onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={1}
          placeholder="Guests"
          value={form.guestCount}
          onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="number"
          min={5}
          placeholder="Wait (mins)"
          value={form.quotedWaitMins}
          onChange={(e) => setForm({ ...form, quotedWaitMins: Number(e.target.value) })}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <button type="submit" className="bg-violet-600 text-white rounded-lg font-semibold text-sm hover:bg-violet-500">
          Add to queue
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="text-center text-slate-500 py-8">No one waiting</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => (
            <div key={entry.id} className="bg-white rounded-xl shadow-card p-4 flex flex-wrap items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-violet-100 text-violet-800 font-bold flex items-center justify-center text-sm">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{entry.guestName}</p>
                <p className="text-sm text-slate-600">
                  {entry.guestCount} guests · {entry.guestPhone}
                  {entry.quotedWaitMins ? ` · ~${entry.quotedWaitMins} min` : ""}
                </p>
                <span className="text-[10px] uppercase font-bold text-slate-500">{entry.status}</span>
              </div>
              <div className="flex gap-2">
                {entry.status === "waiting" && (
                  <button type="button" onClick={() => entryAction(entry.id, "notify")} className="text-xs px-3 py-1.5 rounded-lg bg-sky-100 text-sky-800 font-semibold">
                    Notify
                  </button>
                )}
                <button type="button" onClick={() => entryAction(entry.id, "promote")} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold">
                  Seat / Book
                </button>
                <button type="button" onClick={() => entryAction(entry.id, "cancel")} className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-700">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarGrid({ reservations, onDayClick }: { reservations: Reservation[]; onDayClick: (date: string) => void }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reservations) {
      const key = localDateIso(new Date(r.date));
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [reservations]);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const startDow = month.getDay();
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="bg-white rounded-xl shadow-card p-4">
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="p-1 rounded hover:bg-slate-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="font-semibold">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
        <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="p-1 rounded hover:bg-slate-100">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const iso = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const count = counts.get(iso) ?? 0;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => count > 0 && onDayClick(iso)}
              className={`aspect-square rounded-lg text-sm flex flex-col items-center justify-center ${count ? "bg-violet-50 hover:bg-violet-100 text-violet-900 font-semibold" : "text-slate-400"}`}
            >
              {day}
              {count > 0 && <span className="text-[10px]">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReservationsModule() {
  const [mounted, setMounted] = useState(false);
  const [outletId, setOutletId] = useState("");
  const [tab, setTab] = useState<TabId>("upcoming");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [floor, setFloor] = useState<FloorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [calendarDay, setCalendarDay] = useState<string | null>(null);

  useEffect(() => {
    ensureOutletSelected()
      .then((id) => {
        setOutletId(id || getOutletId() || "");
        setMounted(true);
      })
      .catch(() => {
        setOutletId(getOutletId() || "");
        setMounted(true);
      });
  }, []);

  const load = useCallback(async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const today = localDateIso();
      let path = `/reservations?outletId=${outletId}`;

      if (tab === "today" || tab === "floor") {
        path += `&date=${today}`;
      } else if (tab === "upcoming") {
        const from = new Date();
        from.setDate(from.getDate() + 1);
        from.setHours(0, 0, 0, 0);
        const to = new Date(from);
        to.setDate(to.getDate() + 30);
        path += `&from=${from.toISOString()}&to=${to.toISOString()}`;
      } else if (tab === "cancelled") {
        path += `&date=${today}`;
      } else if (tab === "calendar") {
        const from = new Date();
        from.setDate(1);
        from.setHours(0, 0, 0, 0);
        const to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59);
        path += `&from=${from.toISOString()}&to=${to.toISOString()}`;
      }

      const [resData, floorData] = await Promise.all([
        api<Reservation[]>(path),
        tab === "floor" || tab === "today" ? api<FloorPlan>(`/outlets/${outletId}/floor`) : Promise.resolve(null),
      ]);

      setReservations(resData);
      if (floorData) setFloor(floorData);
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [outletId, tab]);

  useEffect(() => {
    if (!mounted) return;
    if (!outletId) {
      setLoading(false);
      return;
    }
    load();
  }, [mounted, outletId, load]);

  useReservationsRealtime(mounted ? outletId : "", load);

  const filtered = useMemo(() => {
    if (tab === "cancelled") {
      return reservations.filter((r) => r.status === "cancelled" || r.status === "no_show");
    }
    if (tab === "calendar" && calendarDay) {
      return reservations.filter((r) => isOnLocalDay(r.date, calendarDay));
    }
    if (tab === "today" || tab === "floor") {
      const today = localDateIso();
      return reservations.filter(
        (r) => isOnLocalDay(r.date, today) && !["cancelled", "no_show"].includes(r.status),
      );
    }
    return reservations.filter((r) => r.status !== "cancelled" && r.status !== "no_show");
  }, [reservations, tab, calendarDay]);

  const groupedByHour = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of filtered) {
      const hour = new Date(r.date).toLocaleTimeString("en-IN", { hour: "numeric", hour12: true }).replace(":00", "");
      if (!map.has(hour)) map.set(hour, []);
      map.get(hour)!.push(r);
    }
    return [...map.entries()];
  }, [filtered]);

  if (!mounted) {
    return (
      <PageContent>
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      </PageContent>
    );
  }

  if (!outletId) {
    return (
      <PageContent>
        <PageHeader
          title="Reservations"
          description="Table bookings, waitlist, and floor view"
        />
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-md mx-auto">
          <p className="text-slate-600 mb-4">Select an outlet to manage reservations.</p>
          <OutletSelector />
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageHeader
        title="Reservations"
        description="Today's bookings, waitlist, calendar, and floor"
        action={
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-500"
          >
            <Plus className="w-4 h-4" />
            New booking
          </button>
        }
      />
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1 bg-white rounded-xl p-1 shadow-card ring-1 ring-black/[0.04]">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setCalendarDay(null);
              }}
              className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                tab === t.id ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      ) : tab === "waitlist" ? (
        <WaitlistPanel outletId={outletId} onRefresh={load} />
      ) : tab === "floor" && floor ? (
        <FloorView floor={floor} />
      ) : tab === "calendar" ? (
        <div className="space-y-4">
          <CalendarGrid
            reservations={reservations}
            onDayClick={(d) => {
              setCalendarDay(d);
            }}
          />
          {calendarDay && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{formatDate(calendarDay)}</h3>
                <button type="button" onClick={() => setCalendarDay(null)} className="text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {filtered.map((r) => (
                  <ReservationCard key={r.id} r={r} onAction={load} tables={floor?.tables} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {tab === "today" && groupedByHour.length > 0 ? (
            groupedByHour.map(([hour, items]) => (
              <div key={hour}>
                <p className="text-xs font-bold uppercase text-slate-500 mb-2">{hour}</p>
                <div className="space-y-2">
                  {items.map((r) => (
                    <ReservationCard key={r.id} r={r} onAction={load} tables={floor?.tables} />
                  ))}
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-500 py-12">No reservations</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <ReservationCard key={r.id} r={r} onAction={load} tables={floor?.tables} />
              ))}
            </div>
          )}
        </div>
      )}

      {drawerOpen && (
        <ReservationDrawer
          outletId={outletId}
          tables={floor?.tables}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => {
            setDrawerOpen(false);
            load();
          }}
        />
      )}
    </div>
    </PageContent>
  );
}
