"use client";



import { AppToaster } from "@kaana/ui";

import { CapabilitiesProvider } from "@/contexts/CapabilitiesContext";



export function AppProviders({ children }: { children: React.ReactNode }) {

  return (

    <CapabilitiesProvider>

      {children}

      <AppToaster />

    </CapabilitiesProvider>

  );

}


