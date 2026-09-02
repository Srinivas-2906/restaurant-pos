"use client";

import { useEffect, useState } from "react";
import { api, hub, getOutletId } from "@/lib/api";
import { TABLE_STATUS_COLORS } from "@kaana/ui";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

interface TableActiveOrder {
  pendingKot: number;
  inKitchen: number;
  readyCount?: number;
  servedCount?: number;
  allReady?: boolean;
  allServed?: boolean;
  status: string;
  totalAmount: number | string;
  itemQty: number;
}

interface FloorTable {
  id: string;
  number: string;
  status: string;
  activeOrder?: TableActiveOrder | null;
  activeReservation?: { guestName: string; guestCount: number; date: string } | null;
}

function deriveFloorPhase(table: FloorTable): string {
  if (table.status === "blocked") return "blocked";
  if (table.status === "cleaning") return "cleaning";
  if (table.status === "reserved") return "reserved";
  if (!table.activeOrder) return "free";
  if (table.activeOrder.status === "billed" || table.status === "billed") return "billed";
  if (table.activeOrder.pendingKot > 0) return "ordering";
  const readyCount = table.activeOrder.readyCount ?? 0;
  const inKitchen = table.activeOrder.inKitchen ?? 0;
  const servedCount = table.activeOrder.servedCount ?? 0;
  if (servedCount > 0 && (readyCount > 0 || inKitchen > 0)) return "serving";
  if (table.activeOrder.allReady || (readyCount > 0 && inKitchen === 0 && servedCount === 0)) return "ready_to_serve";
  if (inKitchen > 0 || table.activeOrder.status === "kot_fired" || table.activeOrder.status === "preparing") {
    return "kitchen";
  }
  return "ordering";
}

const PHASE_LABELS: Record<string, string> = {
  free: "Available",
  ordering: "Ordering",
  kitchen: "In kitchen",
  ready_to_serve: "Ready",
  serving: "Serving",
  billed: "Bill printed",
  reserved: "Reserved",
  cleaning: "Needs cleaning",
  blocked: "Blocked",
};

export function OrdersModule() {
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [hubOffline, setHubOffline] = useState(false);
  const outletId = getOutletId();

  useEffect(() => {
    if (outletId) {
      api<{ tables?: FloorTable[] } | null>(`/outlets/${outletId}/floor`)
        .then((f) => {
          setTables(f?.tables ?? []);
          setHubOffline(false);
        })
        .catch(() => {
          hub<{ tables?: FloorTable[] }>("/hub/floor")
            .then((f) => { setTables(f.tables ?? []); setHubOffline(true); })
            .catch(() => setHubOffline(true));
        });
    }
  }, [outletId]);

  return (
    <PageContent>
      <PageHeader title="Orders & Floor" description="Live table status and floor operations." />

      <Panel title="Tables">
        {hubOffline && tables.length === 0 ? (
          <EmptyState title="Hub offline" description="Table status requires the local outlet hub or API." />
        ) : tables.length === 0 ? (
          <EmptyState title="No tables" />
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {tables.map((t) => {
              const phase = deriveFloorPhase(t);
              const cls = TABLE_STATUS_COLORS[phase] ?? TABLE_STATUS_COLORS.free;
              return (
                <div key={t.id} className={`p-4 rounded-lg border-2 text-center ${cls}`}>
                  <p className="font-bold">{t.number}</p>
                  <p className="text-xs capitalize mt-1">{PHASE_LABELS[phase] ?? phase}</p>
                  {t.activeReservation && (
                    <p className="text-[10px] mt-1 truncate">{t.activeReservation.guestName}</p>
                  )}
                  {t.activeOrder && (t.activeOrder.readyCount ?? 0) > 0 && (
                    <p className="text-[10px] mt-1 font-semibold">{t.activeOrder.readyCount} ready</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </PageContent>
  );
}
