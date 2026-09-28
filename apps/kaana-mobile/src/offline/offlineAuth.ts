import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import type { PosStaffOfflineSnapshot } from "@kaana/sync-protocol";
import {
  OFFLINE_AUTH_TTL_HOURS,
  OFFLINE_PIN_LOCKOUT_MINUTES,
  OFFLINE_PIN_MAX_ATTEMPTS,
} from "@kaana/sync-protocol";
import { getOfflineDb } from "./database";

const DEVICE_SECRET_KEY = "kaana_pos_device_secret";

async function getDeviceSecret(): Promise<string> {
  let secret = await SecureStore.getItemAsync(DEVICE_SECRET_KEY);
  if (!secret) {
    secret = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_SECRET_KEY, secret);
  }
  return secret;
}

export async function computePinVerifier(pin: string): Promise<string> {
  const secret = await getDeviceSecret();
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${secret}:${pin}`,
  );
}

export async function saveStaffOfflineSnapshot(
  snapshot: Omit<PosStaffOfflineSnapshot, "pinVerifier">,
  pin: string,
): Promise<void> {
  const pinVerifier = await computePinVerifier(pin);
  const db = await getOfflineDb();
  const validUntil = snapshot.offlineAuthValidUntil;
  await db.runAsync(
    `INSERT OR REPLACE INTO staff_offline (
      staff_profile_id, employee_code, display_name, role, permissions_json,
      pin_verifier, offline_auth_valid_until, verified_at, failed_attempts, locked_until
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    snapshot.staffProfileId,
    snapshot.employeeCode,
    snapshot.displayName,
    snapshot.role,
    JSON.stringify(snapshot.permissions),
    pinVerifier,
    validUntil,
    snapshot.verifiedAt,
  );
}

export async function verifyOfflinePin(
  employeeCode: string,
  pin: string,
): Promise<{
  ok: boolean;
  staff?: {
    staffProfileId: string;
    employeeCode: string;
    displayName: string;
    role: string;
    permissions: string[];
  };
  reason?: string;
}> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    "SELECT * FROM staff_offline WHERE employee_code = ?",
    employeeCode,
  );
  if (!row) return { ok: false, reason: "No offline credential. Connect to the internet and sign in once." };

  const lockedUntil = row.locked_until as string | null;
  if (lockedUntil && new Date(lockedUntil) > new Date()) {
    return { ok: false, reason: "Too many failed attempts. Try again later or connect online." };
  }

  const validUntil = row.offline_auth_valid_until as string;
  if (new Date(validUntil) < new Date()) {
    return { ok: false, reason: "Offline access expired. Connect to the internet to sign in." };
  }

  const verifier = await computePinVerifier(pin);
  if (verifier !== row.pin_verifier) {
    const attempts = (row.failed_attempts as number) + 1;
    const locked = attempts >= OFFLINE_PIN_MAX_ATTEMPTS;
    await db.runAsync(
      "UPDATE staff_offline SET failed_attempts = ?, locked_until = ? WHERE staff_profile_id = ?",
      attempts,
      locked ? new Date(Date.now() + OFFLINE_PIN_LOCKOUT_MINUTES * 60_000).toISOString() : null,
      row.staff_profile_id as string,
    );
    return { ok: false, reason: "Invalid PIN" };
  }

  await db.runAsync(
    "UPDATE staff_offline SET failed_attempts = 0, locked_until = NULL WHERE staff_profile_id = ?",
    row.staff_profile_id as string,
  );

  return {
    ok: true,
    staff: {
      staffProfileId: row.staff_profile_id as string,
      employeeCode: row.employee_code as string,
      displayName: row.display_name as string,
      role: row.role as string,
      permissions: JSON.parse(row.permissions_json as string) as string[],
    },
  };
}

export async function hasOfflineCredentialForEmployee(employeeCode: string): Promise<boolean> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM staff_offline WHERE employee_code = ? AND offline_auth_valid_until > ?",
    employeeCode.trim().toUpperCase(),
    new Date().toISOString(),
  );
  return (row?.c ?? 0) > 0;
}

export async function hasValidOfflineStaff(): Promise<boolean> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM staff_offline WHERE offline_auth_valid_until > ?",
    new Date().toISOString(),
  );
  return (row?.c ?? 0) > 0;
}

export { OFFLINE_AUTH_TTL_HOURS };
