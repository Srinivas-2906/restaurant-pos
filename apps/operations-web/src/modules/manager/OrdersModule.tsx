"use client";

import { useEffect, useState } from "react";
import { api, hub, getOutletId } from "@/lib/api";
import { TABLE_STATUS_COLORS } from "@kaana/ui";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

interface Reservation {
  id?: string;
  guestName?: string;
  partySize?: number;
  time?: string;
}

export function OrdersModule() {
  const [tables, setTables] = useState<Array<{ id?: string; number?: string; status?: string }>>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [hubOffline, setHubOffline] = useState(false);
  const outletId = getOutletId();

  useEffect(() => {
    hub<{ tables?: Array<{ id?: string; number?: string; status?: string }> }>("/hub/floor")
      .then((f) => { setTables(f.tables ?? []); setHubOffline(false); })
      .catch(() => setHubOffline(true));
    if (outletId) {
      api<Reservation[]>(`/reservations?outletId=${outletId}&date=${new Date().toISOString().slice(0, 10)}`)
        .then(setReservations).catch(() => setReservations([]));
    }
  }, [outletId]);

  return (
    <PageContent>
      <PageHeader title="Orders & Floor" description="Live table status and today's reservations." />

      <div className="grid md:grid-cols-2 gap-6">
        <Panel title="Tables">
          {hubOffline ? (
            <EmptyState title="Hub offline" description="Table status requires the local outlet hub." />
          ) : tables.length === 0 ? (
            <EmptyState title="No tables" />
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {tables.map((t, i) => {
                const status = t.status ?? "free";
                const cls = TABLE_STATUS_COLORS[status] ?? TABLE_STATUS_COLORS.free;
                return (
                  <div key={t.id ?? i} className={`p-4 rounded-lg border-2 text-center ${cls}`}>
                    <p className="font-bold">{t.number ?? `T${i + 1}`}</p>
                    <p className="text-xs capitalize mt-1">{status}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Reservations today">
          {reservations.length === 0 ? (
            <EmptyState title="No reservations" description="No bookings scheduled for today." />
          ) : (
            <ul className="divide-y divide-gray-100">
              {reservations.map((r, i) => (
                <li key={r.id ?? i} className="py-3 text-sm">
                  <p className="font-medium">{r.guestName ?? "Guest"}</p>
                  <p className="text-gray-500">{r.partySize ?? "—"} guests · {r.time ?? "—"}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageContent>
  );
}
