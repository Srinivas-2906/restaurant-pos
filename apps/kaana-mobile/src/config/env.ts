import Constants from "expo-constants";
import { resolveApiUrl, resolveWsUrl } from "@kaana/api-client";

const extra = Constants.expoConfig?.extra as
  | { apiUrl?: string; wsUrl?: string }
  | undefined;

/** API base URL — set EXPO_PUBLIC_API_URL in .env or app.config.js extra. */
export const API_URL = resolveApiUrl(
  process.env.EXPO_PUBLIC_API_URL ?? extra?.apiUrl,
);

/** Socket.IO events namespace URL. */
export const WS_URL = resolveWsUrl(
  process.env.EXPO_PUBLIC_API_URL ?? extra?.apiUrl,
  process.env.EXPO_PUBLIC_WS_URL ?? extra?.wsUrl,
);

/** Human-readable dev setup notes (see README in repo docs). */
export const DEV_NETWORK_HINT =
  "Android emulator: http://10.0.2.2:4000/api · Physical device: use your PC LAN IP";
