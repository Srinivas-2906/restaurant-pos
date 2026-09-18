"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ResolvedCapabilities } from "@kaana/shared-types";
import { subscribeConfigUpdates } from "@kaana/api-client";
import {
  fetchCapabilities,
  getOrganizationId,
  getStoredCapabilities,
  WS_URL,
} from "@/lib/api";

export interface CapabilitiesContextValue {
  capabilities: ResolvedCapabilities | null;
  ready: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const CapabilitiesContext = createContext<CapabilitiesContextValue | undefined>(undefined);

export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const [capabilities, setCapabilities] = useState<ResolvedCapabilities | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) return;
    try {
      const data = (await fetchCapabilities()) as ResolvedCapabilities;
      setCapabilities(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load capabilities");
    }
  }, []);

  useEffect(() => {
    const stored = getStoredCapabilities();
    if (stored) {
      setCapabilities(stored);
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setReady(true);
      return;
    }

    refresh().finally(() => setReady(true));
  }, [refresh]);

  useEffect(() => {
    const orgId = getOrganizationId();
    const token = localStorage.getItem("token");
    if (!orgId || !token) return;

    const unsubscribe = subscribeConfigUpdates(orgId, token, () => {
      void refresh();
    }, WS_URL);

    return unsubscribe;
  }, [refresh]);

  const value = useMemo(
    () => ({ capabilities, ready, error, refresh }),
    [capabilities, ready, error, refresh],
  );

  return (
    <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>
  );
}

export function useCapabilities(): CapabilitiesContextValue {
  const ctx = useContext(CapabilitiesContext);
  if (!ctx) {
    throw new Error("useCapabilities must be used within CapabilitiesProvider");
  }
  return ctx;
}
