"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, hub } from "@/lib/api";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

interface Ticket {
  id?: string;
  subject?: string;
  status?: string;
}

export function SupportModule() {
  const [hubOnline, setHubOnline] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    hub("/hub/diagnostics").then(() => setHubOnline(true)).catch(() => setHubOnline(false));
    api<Ticket[]>("/diagnostics/tickets").then(setTickets).catch(() => setTickets([]));
  }, []);

  return (
    <PageContent className="space-y-6">
      <PageHeader title="Support & Issues" description="Hub diagnostics and support tickets." />

      <Panel title="Hub status">
        {hubOnline === null ? (
          <p className="text-gray-400 text-sm">Checking...</p>
        ) : hubOnline ? (
          <div className="flex items-center justify-between">
            <p className="text-green-700 font-medium">Local hub is online</p>
            <Link href="http://localhost:4100/status" target="_blank" className="text-sm text-kaana hover:underline">
              Open diagnostics
            </Link>
          </div>
        ) : (
          <EmptyState title="Hub offline" description="Start outlet-hub on port 4100 for local diagnostics." />
        )}
      </Panel>

      <Panel title="Support tickets">
        {tickets.length === 0 ? (
          <EmptyState title="No open tickets" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {tickets.map((t, i) => (
              <li key={t.id ?? i} className="py-3 text-sm flex justify-between">
                <span>{t.subject ?? "Ticket"}</span>
                <span className="text-gray-500 capitalize">{t.status ?? "open"}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}
