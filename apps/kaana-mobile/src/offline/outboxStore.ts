import type { OutboxRecord, PersistentOutboxStore } from "@kaana/sync-engine";
import type { PosOutboxStatus } from "@kaana/sync-protocol";
import { getOfflineDb, uuid } from "./database";

function rowToRecord(row: Record<string, unknown>): OutboxRecord {
  return {
    id: row.id as string,
    operationType: row.operation_type as string,
    aggregateId: row.aggregate_id as string,
    localEntityId: row.local_entity_id as string,
    idempotencyKey: row.idempotency_key as string,
    payload: JSON.parse(row.payload_json as string) as Record<string, unknown>,
    sequence: row.sequence as number,
    status: row.status as PosOutboxStatus,
    attempts: row.attempts as number,
    lastAttemptAt: (row.last_attempt_at as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    staffProfileId: row.staff_profile_id as string,
    employeeCode: row.employee_code as string,
    terminalId: row.terminal_id as string,
    occurredAt: row.occurred_at as string,
    createdAt: row.created_at as string,
  };
}

export class SqliteOutboxStore implements PersistentOutboxStore {
  async enqueue(
    record: Omit<OutboxRecord, "attempts" | "lastAttemptAt" | "lastError" | "createdAt">,
  ): Promise<OutboxRecord> {
    const db = await getOfflineDb();
    const now = new Date().toISOString();
    const full: OutboxRecord = {
      ...record,
      attempts: 0,
      lastAttemptAt: null,
      lastError: null,
      createdAt: now,
    };
    await db.runAsync(
      `INSERT INTO sync_outbox (
        id, operation_type, aggregate_id, local_entity_id, idempotency_key,
        payload_json, sequence, status, attempts, staff_profile_id, employee_code,
        terminal_id, occurred_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      full.id,
      full.operationType,
      full.aggregateId,
      full.localEntityId,
      full.idempotencyKey,
      JSON.stringify(full.payload),
      full.sequence,
      full.status,
      full.staffProfileId,
      full.employeeCode,
      full.terminalId,
      full.occurredAt,
      full.createdAt,
    );
    return full;
  }

  async getPending(limit = 50): Promise<OutboxRecord[]> {
    const db = await getOfflineDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM sync_outbox
       WHERE status IN ('pending', 'failed')
       ORDER BY sequence ASC
       LIMIT ?`,
      limit,
    );
    return rows.map(rowToRecord);
  }

  async getPendingForDisplay(limit = 50): Promise<OutboxRecord[]> {
    const db = await getOfflineDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM sync_outbox
       WHERE status IN ('pending', 'failed', 'syncing')
       ORDER BY sequence ASC
       LIMIT ?`,
      limit,
    );
    return rows.map(rowToRecord);
  }

  async getPendingCount(): Promise<number> {
    const db = await getOfflineDb();
    const row = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM sync_outbox WHERE status IN ('pending', 'syncing')",
    );
    return row?.c ?? 0;
  }

  async getFailedCount(): Promise<number> {
    const db = await getOfflineDb();
    const row = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM sync_outbox WHERE status = 'failed'",
    );
    return row?.c ?? 0;
  }

  /** Unstick commands left in `syncing` after a crashed/interrupted batch. */
  async recoverStaleSyncing(staleAfterMs = 15_000): Promise<number> {
    const db = await getOfflineDb();
    const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
    const result = await db.runAsync(
      `UPDATE sync_outbox SET status = 'pending'
       WHERE status = 'syncing'
         AND (last_attempt_at IS NULL OR last_attempt_at < ?)`,
      cutoff,
    );
    return result.changes ?? 0;
  }

  /** Drop orphan settle commands that target a server aggregate with no local order. */
  async abandonOrphanSettleCommands(): Promise<number> {
    const db = await getOfflineDb();
    const orphans = await db.getAllAsync<{ id: string; aggregate_id: string }>(
      `SELECT id, aggregate_id FROM sync_outbox
       WHERE operation_type = 'SETTLE'
         AND status IN ('pending', 'failed', 'syncing')
         AND aggregate_id NOT IN (SELECT id FROM orders)
         AND aggregate_id NOT IN (SELECT cloud_id FROM orders WHERE cloud_id IS NOT NULL)`,
    );
    for (const row of orphans) {
      await db.runAsync(
        "UPDATE sync_outbox SET status = 'acked', last_error = ? WHERE id = ?",
        "Abandoned orphan settle — no local order",
        row.id,
      );
    }
    return orphans.length;
  }

  async getConflictCount(): Promise<number> {
    const db = await getOfflineDb();
    const row = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM sync_outbox WHERE status = 'conflict'",
    );
    return row?.c ?? 0;
  }

  async markSyncing(id: string): Promise<void> {
    const db = await getOfflineDb();
    await db.runAsync(
      "UPDATE sync_outbox SET status = 'syncing', last_attempt_at = ? WHERE id = ?",
      new Date().toISOString(),
      id,
    );
  }

  async markAcked(id: string, _serverEntityId?: string): Promise<void> {
    const db = await getOfflineDb();
    await db.runAsync("UPDATE sync_outbox SET status = 'acked', last_error = NULL WHERE id = ?", id);
  }

  async markConflict(id: string, error: string, conflictPayload?: Record<string, unknown>): Promise<void> {
    const db = await getOfflineDb();
    const row = await db.getFirstAsync<{ aggregate_id: string }>(
      "SELECT aggregate_id FROM sync_outbox WHERE id = ?",
      id,
    );
    await db.runAsync(
      "UPDATE sync_outbox SET status = 'conflict', last_error = ? WHERE id = ?",
      error,
      id,
    );
    if (row && conflictPayload) {
      await db.runAsync(
        `INSERT INTO sync_conflicts (id, outbox_id, aggregate_id, conflict_code, message, server_state_json, resolution_options_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        uuid(),
        id,
        row.aggregate_id,
        (conflictPayload.code as string) ?? "CONFLICT",
        error,
        JSON.stringify(conflictPayload.serverState ?? {}),
        JSON.stringify(conflictPayload.resolutionOptions ?? []),
        new Date().toISOString(),
      );
    }
  }

  async markFailed(id: string, error: string, permanent = false): Promise<void> {
    const db = await getOfflineDb();
    await db.runAsync(
      `UPDATE sync_outbox SET
        status = ?,
        attempts = attempts + 1,
        last_attempt_at = ?,
        last_error = ?
       WHERE id = ?`,
      permanent ? "failed" : "pending",
      new Date().toISOString(),
      error,
      id,
    );
  }

  async getByAggregate(aggregateId: string): Promise<OutboxRecord[]> {
    const db = await getOfflineDb();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      "SELECT * FROM sync_outbox WHERE aggregate_id = ? ORDER BY sequence ASC",
      aggregateId,
    );
    return rows.map(rowToRecord);
  }

  async getOldestPendingAge(): Promise<number | null> {
    const db = await getOfflineDb();
    const row = await db.getFirstAsync<{ created_at: string }>(
      "SELECT created_at FROM sync_outbox WHERE status IN ('pending', 'failed') ORDER BY created_at ASC LIMIT 1",
    );
    if (!row) return null;
    return Date.now() - new Date(row.created_at).getTime();
  }

  async nextSequence(aggregateId: string): Promise<number> {
    const db = await getOfflineDb();
    const row = await db.getFirstAsync<{ max_seq: number | null }>(
      "SELECT MAX(sequence) as max_seq FROM sync_outbox WHERE aggregate_id = ?",
      aggregateId,
    );
    return (row?.max_seq ?? 0) + 1;
  }

  async nextGlobalSequence(): Promise<number> {
    const db = await getOfflineDb();
    const row = await db.getFirstAsync<{ max_seq: number | null }>(
      "SELECT MAX(sequence) as max_seq FROM sync_outbox",
    );
    return (row?.max_seq ?? 0) + 1;
  }
}

export const outboxStore = new SqliteOutboxStore();
