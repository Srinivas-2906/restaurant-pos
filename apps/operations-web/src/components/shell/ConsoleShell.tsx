"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AppShell as ShellLayout } from "./AppShell";

interface ConsoleShellProps {
  children: React.ReactNode;
  hubOffline?: boolean;
}

export function ConsoleShell({ children, hubOffline }: ConsoleShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      {mobileOpen && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}
      <div className="lg:pl-sidebar min-h-screen flex flex-col">
        <TopBar onMenuClick={() => setMobileOpen(true)} hubOffline={hubOffline} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export { ShellLayout };
