import { createOperationalApi, type OperationalApiTokens } from "../operational/createOperationalApi";
import { API_URL } from "../config/env";

export type PosApiTokens = OperationalApiTokens;

export function createPosApi(tokens: PosApiTokens) {
  return createOperationalApi(tokens);
}

export type PosApi = ReturnType<typeof createPosApi>;
