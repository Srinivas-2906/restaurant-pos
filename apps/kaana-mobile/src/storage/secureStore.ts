import * as SecureStore from "expo-secure-store";

export async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore missing keys
  }
}

export async function secureGetJson<T>(key: string): Promise<T | null> {
  const raw = await secureGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function secureSetJson(key: string, value: unknown): Promise<void> {
  await secureSet(key, JSON.stringify(value));
}
