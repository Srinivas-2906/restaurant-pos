import {
  createApiClient,
  createKdsApi,
  createMenuApi,
  createOrdersApi,
  createOutletsApi,
  isAccessTokenExpired,
} from "@kaana/api-client";
import { API_URL } from "../config/env";

export type OperationalApiTokens = {
  accessToken: string;
  refreshToken?: string | null;
  onUnauthorized?: () => void;
  setAccessToken?: (token: string) => void;
};

/** Shared orders/menu/floor client for POS and Captain operational shells. */
export function createOperationalApi(tokens: OperationalApiTokens) {
  let accessToken = tokens.accessToken;

  const client = createApiClient({
    apiUrl: API_URL,
    getToken: () => accessToken,
    getRefreshToken: () => tokens.refreshToken ?? null,
    setToken: (token) => {
      accessToken = token;
      tokens.setAccessToken?.(token);
    },
    onUnauthorized: tokens.onUnauthorized,
  });

  return {
    client,
    orders: createOrdersApi(client),
    menu: createMenuApi(client),
    outlets: createOutletsApi(client),
    kds: createKdsApi(client),
    isTokenExpired: () => isAccessTokenExpired(accessToken),
  };
}

export type OperationalApi = ReturnType<typeof createOperationalApi>;
