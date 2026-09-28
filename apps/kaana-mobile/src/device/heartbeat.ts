const HEARTBEAT_INTERVAL_MS = 60_000;

export type HeartbeatPayload = {
  deviceId?: string;
  appVersion?: string;
  platform?: string;
  osVersion?: string;
};

export function startTerminalHeartbeat(
  send: (payload: HeartbeatPayload) => Promise<unknown>,
  payload: HeartbeatPayload,
): () => void {
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    void send(payload).catch(() => undefined);
  };

  tick();
  const timer = setInterval(tick, HEARTBEAT_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
