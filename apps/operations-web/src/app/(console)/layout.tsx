"use client";

import { useEffect, useRef, useState } from "react";
import { notify } from "@kaana/ui";
import { AuthGuard } from "@/components/AuthGuard";
import { OutletBootstrap } from "@/components/OutletBootstrap";
import { AppProviders } from "@/components/AppProviders";
import { ConsoleShell } from "@/components/shell/ConsoleShell";
import { hub } from "@/lib/api";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const [hubOffline, setHubOffline] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    hub("/hub/floor")
      .then(() => setHubOffline(false))
      .catch(() => setHubOffline(true));
  }, []);

  useEffect(() => {
    if (hubOffline && !wasOfflineRef.current) {
      notify.warning("Outlet hub offline — some features may be unavailable");
    }
    wasOfflineRef.current = hubOffline;
  }, [hubOffline]);

  return (
    <AppProviders>
      <AuthGuard>
        <OutletBootstrap />
        <ConsoleShell hubOffline={hubOffline}>{children}</ConsoleShell>
      </AuthGuard>
    </AppProviders>
  );
}
