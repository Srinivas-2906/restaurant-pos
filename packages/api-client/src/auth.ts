import type { SignupDto } from "@kaana/shared-types";
import type { ApiClient } from "./http";
import type { StoredAuthUser } from "./session";

export function createAuthApi(client: ApiClient, storage: {
  setSession: (data: { accessToken: string; refreshToken: string; user: StoredAuthUser }) => void;
  clearOperationalSession: () => void;
}) {
  return {
    login(email: string, password: string) {
      return client.api<{ accessToken: string; refreshToken: string; user: StoredAuthUser }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
      ).then((data) => {
        storage.clearOperationalSession();
        storage.setSession(data);
        return data;
      });
    },
    signup(payload: SignupDto) {
      return client.api<{ accessToken: string; refreshToken: string; user: StoredAuthUser }>(
        "/auth/signup",
        { method: "POST", body: JSON.stringify(payload) },
      ).then((data) => {
        storage.clearOperationalSession();
        storage.setSession(data);
        return data;
      });
    },
  };
}
