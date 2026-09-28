import type { CapabilityBootstrapPayload } from "@kaana/shared-types";
import type { StoredAuthUser } from "@kaana/api-client";
import { STORAGE_KEYS } from "../storage/keys";
import {
  secureDelete,
  secureGet,
  secureGetJson,
  secureSet,
  secureSetJson,
} from "../storage/secureStore";
import type { ManagementSession, TerminalContext, TerminalCredential } from "../session/types";

export async function loadTerminalCredential(): Promise<TerminalCredential | null> {
  const raw = await secureGetJson<TerminalCredential>(STORAGE_KEYS.terminalCredential);
  if (raw?.terminalId && raw?.deviceSecret) return raw;
  return null;
}

export async function saveTerminalCredential(credential: TerminalCredential): Promise<void> {
  await secureSetJson(STORAGE_KEYS.terminalCredential, credential);
}

export async function loadTerminalContext(): Promise<TerminalContext | null> {
  return secureGetJson<TerminalContext>(STORAGE_KEYS.terminalContext);
}

export async function saveTerminalContext(context: TerminalContext): Promise<void> {
  await secureSetJson(STORAGE_KEYS.terminalContext, context);
}

export async function clearTerminalStorage(): Promise<void> {
  await secureDelete(STORAGE_KEYS.terminalCredential);
  await secureDelete(STORAGE_KEYS.terminalContext);
}

export async function loadManagementTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    secureGet(STORAGE_KEYS.managementAccessToken),
    secureGet(STORAGE_KEYS.managementRefreshToken),
  ]);
  return { accessToken, refreshToken };
}

export async function loadManagementUser(): Promise<StoredAuthUser | null> {
  return secureGetJson<StoredAuthUser>(STORAGE_KEYS.managementUser);
}

export async function loadManagementCapabilities(): Promise<CapabilityBootstrapPayload | null> {
  return secureGetJson<CapabilityBootstrapPayload>(STORAGE_KEYS.managementCapabilities);
}

export async function saveManagementSession(session: ManagementSession): Promise<void> {
  await Promise.all([
    secureSet(STORAGE_KEYS.managementAccessToken, session.accessToken),
    secureSet(STORAGE_KEYS.managementRefreshToken, session.refreshToken),
    secureSetJson(STORAGE_KEYS.managementUser, session.user),
    secureSetJson(STORAGE_KEYS.managementCapabilities, session.capabilities),
  ]);
}

export async function clearManagementStorage(): Promise<void> {
  await Promise.all([
    secureDelete(STORAGE_KEYS.managementAccessToken),
    secureDelete(STORAGE_KEYS.managementRefreshToken),
    secureDelete(STORAGE_KEYS.managementUser),
    secureDelete(STORAGE_KEYS.managementCapabilities),
  ]);
}
