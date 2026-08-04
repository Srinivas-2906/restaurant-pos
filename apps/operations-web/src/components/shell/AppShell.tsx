"use client";

import { useState } from "react";

interface AppShellProps {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ sidebar, topbar, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface flex">
      {sidebar}
      {mobileOpen && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}
      <div className="flex-1 min-w-0 min-h-screen flex flex-col">
        {topbar}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export function useMobileSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return { mobileOpen, setMobileOpen, toggle: () => setMobileOpen((v) => !v), close: () => setMobileOpen(false) };
}
