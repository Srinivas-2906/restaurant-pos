"use client";

import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { ConsoleShell } from "@/components/shell/ConsoleShell";
import { hub } from "@/lib/api";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const [hubOffline, setHubOffline] = useState(false);

  useEffect(() => {
    hub("/hub/floor")
      .then(() => setHubOffline(false))
      .catch(() => setHubOffline(true));
  }, []);

  return (
    <AuthGuard>
      <ConsoleShell hubOffline={hubOffline}>{children}</ConsoleShell>
    </AuthGuard>
  );
}
