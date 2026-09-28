import type { MenuCategory } from "@kaana/api-client";

export const MENU_REMOTE_TIMEOUT_MS = 8_000;
export const API_PROBE_TIMEOUT_MS = 4_000;

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export type MenuRefreshLog = (message: string) => void;

export type RefreshPosMenuParams = {
  outletId: string;
  probeReachability: () => Promise<boolean>;
  fetchRemoteMenu: () => Promise<MenuCategory[]>;
  loadCachedMenu: (outletId: string) => Promise<MenuCategory[]>;
  persistMenuCache: (outletId: string, menu: MenuCategory[]) => Promise<void>;
  ensureDbReady?: () => Promise<unknown>;
  remoteTimeoutMs?: number;
  probeTimeoutMs?: number;
  log?: MenuRefreshLog;
};

export type RefreshPosMenuResult = {
  menu: MenuCategory[];
  source: "remote" | "cache" | "none";
  menuReady: boolean;
  blockedMessage: string | null;
  apiReachable: boolean;
};

export const INTERNET_REQUIRED_MENU_MESSAGE =
  "Connect to the internet once to set up this POS.";

export const LOCAL_MENU_READ_ERROR_MESSAGE =
  "Local menu data could not be read. Restart the app or connect online once.";

function devMenuLog(log: MenuRefreshLog | undefined, message: string) {
  log?.(message);
}

export async function refreshPosMenu(
  params: RefreshPosMenuParams,
): Promise<RefreshPosMenuResult> {
  const log = (message: string) => devMenuLog(params.log, message);
  const remoteTimeout = params.remoteTimeoutMs ?? MENU_REMOTE_TIMEOUT_MS;
  const probeTimeout = params.probeTimeoutMs ?? API_PROBE_TIMEOUT_MS;
  const outletId = params.outletId?.trim() ?? "";

  if (params.ensureDbReady) {
    await params.ensureDbReady();
  }
  log("[POS MENU] db ready");

  let cached: MenuCategory[] = [];
  try {
    cached = await params.loadCachedMenu(outletId);
    const itemCount = cached.reduce((sum, cat) => sum + cat.items.length, 0);
    log(`[POS MENU] cache rows=${itemCount} categories=${cached.length}`);
  } catch (error) {
    log(
      `[POS MENU] cache read failed ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      menu: [],
      source: "none",
      menuReady: false,
      blockedMessage: LOCAL_MENU_READ_ERROR_MESSAGE,
      apiReachable: false,
    };
  }

  let reachable = false;
  try {
    log("[POS MENU] remote probe start");
    reachable = await withTimeout(
      params.probeReachability(),
      probeTimeout,
      "reachability probe",
    );
    log(reachable ? "[POS MENU] remote probe success" : "[POS MENU] remote probe failed");
  } catch (error) {
    log(
      `[POS MENU] remote failed ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    reachable = false;
  }

  if (!reachable) {
    if (cached.length > 0) {
      log("[POS MENU] using cache");
      return {
        menu: cached,
        source: "cache",
        menuReady: true,
        blockedMessage: null,
        apiReachable: false,
      };
    }
    log("[POS MENU] no cache");
    return {
      menu: [],
      source: "none",
      menuReady: false,
      blockedMessage: INTERNET_REQUIRED_MENU_MESSAGE,
      apiReachable: false,
    };
  }

  if (!outletId) {
    if (cached.length > 0) {
      log("[POS MENU] using cache");
      return {
        menu: cached,
        source: "cache",
        menuReady: true,
        blockedMessage: null,
        apiReachable: reachable,
      };
    }
    return {
      menu: [],
      source: "none",
      menuReady: false,
      blockedMessage: "Outlet not ready yet. Try again in a moment.",
      apiReachable: reachable,
    };
  }

  log("[POS MENU] remote fetch start");
  try {
    const remote = await withTimeout(
      params.fetchRemoteMenu(),
      remoteTimeout,
      "menu fetch",
    );
    await params.persistMenuCache(outletId, remote);
    log("[POS MENU] remote success");
    return {
      menu: remote,
      source: "remote",
      menuReady: true,
      blockedMessage: null,
      apiReachable: true,
    };
  } catch (error) {
    log(
      `[POS MENU] remote failed ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    if (cached.length > 0) {
      log("[POS MENU] using cache");
      return {
        menu: cached,
        source: "cache",
        menuReady: true,
        blockedMessage: null,
        apiReachable: false,
      };
    }
    log("[POS MENU] no cache");
    return {
      menu: [],
      source: "none",
      menuReady: false,
      blockedMessage: INTERNET_REQUIRED_MENU_MESSAGE,
      apiReachable: false,
    };
  }
}
