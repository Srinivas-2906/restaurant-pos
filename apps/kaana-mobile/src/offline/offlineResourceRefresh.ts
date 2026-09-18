import {
  API_PROBE_TIMEOUT_MS,
  MENU_REMOTE_TIMEOUT_MS,
  type MenuRefreshLog,
  withTimeout,
} from "./menuRefresh";

export type OfflineRefreshResult<T> = {
  data: T;
  source: "remote" | "cache" | "none";
  apiReachable: boolean;
  readError: string | null;
};

export type RefreshWithOfflineFallbackParams<T> = {
  outletId: string;
  label: string;
  emptyValue: T;
  ensureDbReady?: () => Promise<unknown>;
  loadCache: (outletId: string) => Promise<T>;
  isEmpty: (data: T) => boolean;
  probeReachability: () => Promise<boolean>;
  fetchRemote: () => Promise<T>;
  persistCache: (outletId: string, data: T) => Promise<void>;
  readErrorMessage?: string;
  remoteTimeoutMs?: number;
  probeTimeoutMs?: number;
  log?: MenuRefreshLog;
};

export async function refreshWithOfflineFallback<T>(
  params: RefreshWithOfflineFallbackParams<T>,
): Promise<OfflineRefreshResult<T>> {
  const log = (message: string) => params.log?.(message);
  const remoteTimeout = params.remoteTimeoutMs ?? MENU_REMOTE_TIMEOUT_MS;
  const probeTimeout = params.probeTimeoutMs ?? API_PROBE_TIMEOUT_MS;
  const outletId = params.outletId?.trim() ?? "";
  const tag = `[POS ${params.label}]`;

  if (params.ensureDbReady) {
    await params.ensureDbReady();
  }
  log(`${tag} db ready`);

  let cached = params.emptyValue;
  try {
    cached = await params.loadCache(outletId);
    log(`${tag} cache loaded empty=${params.isEmpty(cached)}`);
  } catch (error) {
    log(
      `${tag} cache read failed ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      data: params.emptyValue,
      source: "none",
      apiReachable: false,
      readError:
        params.readErrorMessage ??
        "Local data could not be read. Restart the app or connect online once.",
    };
  }

  let reachable = false;
  try {
    log(`${tag} remote probe start`);
    reachable = await withTimeout(
      params.probeReachability(),
      probeTimeout,
      `${params.label} reachability probe`,
    );
    log(reachable ? `${tag} remote probe success` : `${tag} remote probe failed`);
  } catch (error) {
    log(
      `${tag} remote failed ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    reachable = false;
  }

  if (!reachable) {
    if (!params.isEmpty(cached)) {
      log(`${tag} using cache`);
      return { data: cached, source: "cache", apiReachable: false, readError: null };
    }
    log(`${tag} no cache`);
    return { data: cached, source: "none", apiReachable: false, readError: null };
  }

  if (!outletId) {
    if (!params.isEmpty(cached)) {
      log(`${tag} using cache`);
      return { data: cached, source: "cache", apiReachable: reachable, readError: null };
    }
    return { data: cached, source: "none", apiReachable: reachable, readError: null };
  }

  log(`${tag} remote fetch start`);
  try {
    const remote = await withTimeout(
      params.fetchRemote(),
      remoteTimeout,
      `${params.label} fetch`,
    );
    await params.persistCache(outletId, remote);
    log(`${tag} remote success`);
    return { data: remote, source: "remote", apiReachable: true, readError: null };
  } catch (error) {
    log(
      `${tag} remote failed ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    if (!params.isEmpty(cached)) {
      log(`${tag} using cache`);
      return { data: cached, source: "cache", apiReachable: false, readError: null };
    }
    log(`${tag} no cache`);
    return { data: cached, source: "none", apiReachable: false, readError: null };
  }
}
