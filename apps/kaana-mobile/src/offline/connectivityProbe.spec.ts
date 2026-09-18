import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./syncWorker", () => ({
  checkApiReachability: vi.fn(),
}));

import { checkApiReachability } from "./syncWorker";
import { probeStableApiReachability, resetStableConnectivityForTests } from "./connectivityProbe";

describe("probeStableApiReachability", () => {
  beforeEach(() => {
    resetStableConnectivityForTests();
    vi.mocked(checkApiReachability).mockReset();
  });

  afterEach(() => {
    resetStableConnectivityForTests();
  });

  it("requires consecutive failures before flipping offline", async () => {
    vi.mocked(checkApiReachability).mockResolvedValue(false);

    await expect(probeStableApiReachability()).resolves.toBe(true);
    await expect(probeStableApiReachability()).resolves.toBe(false);
  });

  it("requires consecutive successes before flipping online", async () => {
    resetStableConnectivityForTests();
    vi.mocked(checkApiReachability).mockResolvedValue(false);
    await probeStableApiReachability();
    await probeStableApiReachability();

    vi.mocked(checkApiReachability).mockResolvedValue(true);
    await expect(probeStableApiReachability()).resolves.toBe(false);
    await expect(probeStableApiReachability()).resolves.toBe(true);
  });
});
