import { checkApiReachability } from "./syncWorker";

const ONLINE_AFTER = 2;
const OFFLINE_AFTER = 2;

let probeInFlight: Promise<boolean> | null = null;
let consecutiveSuccess = 0;
let consecutiveFailure = 0;
let stableReachable = true;

async function runHealthProbe(): Promise<boolean> {
  if (probeInFlight) return probeInFlight;
  probeInFlight = checkApiReachability().finally(() => {
    probeInFlight = null;
  });
  return probeInFlight;
}

/** Debounced reachability — avoids offline/online banner flicker from single probe failures. */
export async function probeStableApiReachability(): Promise<boolean> {
  const reachable = await runHealthProbe();

  if (reachable) {
    consecutiveSuccess += 1;
    consecutiveFailure = 0;
    if (!stableReachable && consecutiveSuccess >= ONLINE_AFTER) {
      stableReachable = true;
    }
    if (stableReachable) {
      consecutiveSuccess = ONLINE_AFTER;
    }
  } else {
    consecutiveFailure += 1;
    consecutiveSuccess = 0;
    if (stableReachable && consecutiveFailure >= OFFLINE_AFTER) {
      stableReachable = false;
    }
    if (!stableReachable) {
      consecutiveFailure = OFFLINE_AFTER;
    }
  }

  return stableReachable;
}

/** Test helper */
export function resetStableConnectivityForTests() {
  probeInFlight = null;
  consecutiveSuccess = 0;
  consecutiveFailure = 0;
  stableReachable = true;
}
