"use client";

import { AppToaster } from "@kaana/ui";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AppToaster />
    </>
  );
}
