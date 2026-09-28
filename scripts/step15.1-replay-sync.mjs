/**
 * Replay acknowledged POS sync batch for duplicate-protection proof.
 * Usage: node scripts/step15.1-replay-sync.mjs <localOrderId> <terminalId>
 */
import Database from "../packages/outlet-db/node_modules/better-sqlite3/lib/index.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = process.env.API_BASE ?? "http://localhost:4000/api";
const POS_SECRET = "kaana-dev-pos-01-secret";
const localOrderId = process.argv[2];
const terminalId = process.argv[3];
const dbPath = join(tmpdir(), "kaana_pos_offline_step15.db");

if (!localOrderId || !terminalId || !existsSync(dbPath)) {
  console.log("duplicateReplayAcked=skipped");
  process.exit(0);
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

const db = new Database(dbPath, { readonly: true });
const rows = db
  .prepare(
    `SELECT id, idempotency_key, operation_type, aggregate_id, local_entity_id,
            payload_json, sequence, staff_profile_id, employee_code, terminal_id, occurred_at
     FROM sync_outbox WHERE aggregate_id = ? ORDER BY sequence`,
  )
  .all(localOrderId);
db.close();

if (!rows.length) {
  console.log("duplicateReplayAcked=skipped");
  process.exit(0);
}

const terminalAuth = { Authorization: `Terminal ${terminalId}:${POS_SECRET}` };
const staff = await api("/operational/terminals/me/eligible-staff", { headers: terminalAuth });
const emp = staff.find((s) => s.employeeCode === "EMP001") ?? staff[0];
const session = await api("/operational/pin-login", {
  method: "POST",
  headers: terminalAuth,
  body: JSON.stringify({ staffProfileId: emp.id, pin: "1111" }),
});
const bearer = { Authorization: `Bearer ${session.accessToken}` };

const before = await api(`/orders?limit=50`);
const beforeList = before.value ?? before;
const beforeSettled = beforeList.filter((o) => o.status === "settled").length;

const commands = rows.map((row) => ({
  id: row.id,
  idempotencyKey: row.idempotency_key,
  outletId: row.terminal_id ? undefined : undefined,
  deviceId: `mobile:${terminalId}`,
  terminalId,
  staffProfileId: row.staff_profile_id,
  employeeCode: row.employee_code,
  operationType: row.operation_type,
  aggregateId: row.aggregate_id,
  localEntityId: row.local_entity_id,
  payload: JSON.parse(row.payload_json),
  occurredAt: row.occurred_at,
  sequence: row.sequence,
}));

const outletId = commands[0]?.payload?.outletId;
const batch = {
  outletId: (await api("/outlets", { headers: bearer })).find?.((o) => o.code === "MAIN-001")?.id
    ?? (await api("/outlets", { headers: { Authorization: `Bearer ${(await api("/auth/login", { method: "POST", body: JSON.stringify({ email: "owner@kaanafoods.in", password: "password123" }) })).accessToken}` } }))[0]?.id,
  deviceId: `mobile:${terminalId}`,
  terminalId,
  commands: commands.map((c) => ({ ...c, outletId: undefined })),
};

// Resolve outlet from owner login
const owner = await api("/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: "owner@kaanafoods.in", password: "password123" }),
});
const outlets = await api("/outlets", { headers: { Authorization: `Bearer ${owner.accessToken}` } });
const outlet = (Array.isArray(outlets) ? outlets : outlets.value ?? outlets).find((o) => o.code === "MAIN-001");
batch.outletId = outlet.id;
batch.commands = commands.map((c) => ({ ...c, outletId: outlet.id }));

const replay = await api("/sync/pos/batch", {
  method: "POST",
  headers: bearer,
  body: JSON.stringify(batch),
});

const allAcked = replay.results.every((r) => r.status === "acked");
const after = await api("/orders?limit=50", { headers: { Authorization: `Bearer ${owner.accessToken}` } });
const afterList = after.value ?? after;
const afterSettled = afterList.filter((o) => o.status === "settled").length;

console.log(`duplicateReplayAcked=${allAcked}`);
console.log(`duplicateOrderCountSame=${beforeSettled === afterSettled}`);
