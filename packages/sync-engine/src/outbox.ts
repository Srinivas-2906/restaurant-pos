import type { PosOutboxStatus } from "@kaana/sync-protocol";

export interface OutboxRecord {
  id: string;
  operationType: string;
  aggregateId: string;
  localEntityId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  sequence: number;
  status: PosOutboxStatus;
  attempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  staffProfileId: string;
  employeeCode: string;
  terminalId: string;
  occurredAt: string;
  createdAt: string;
}

/** Platform-agnostic persistent outbox — mobile implements via expo-sqlite */
export interface PersistentOutboxStore {
  enqueue(record: Omit<OutboxRecord, "attempts" | "lastAttemptAt" | "lastError" | "createdAt">): OutboxRecord | Promise<OutboxRecord>;
  getPending(limit?: number): OutboxRecord[] | Promise<OutboxRecord[]>;
  getPendingCount(): number | Promise<number>;
  getConflictCount(): number | Promise<number>;
  markSyncing(id: string): void | Promise<void>;
  markAcked(id: string, serverEntityId?: string): void | Promise<void>;
  markConflict(id: string, error: string, conflictPayload?: Record<string, unknown>): void | Promise<void>;
  markFailed(id: string, error: string, permanent?: boolean): void | Promise<void>;
  getByAggregate(aggregateId: string): OutboxRecord[] | Promise<OutboxRecord[]>;
  getOldestPendingAge(): number | null | Promise<number | null>;
}

export function computeBackoffMs(attempts: number): number {
  const base = Math.min(60_000, 1000 * 2 ** attempts);
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

export function isRetryableHttpStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429;
}

export function isAuthError(status: number): boolean {
  return status === 401 || status === 403;
}

export function isConflictStatus(status: number): boolean {
  return status === 409;
}
