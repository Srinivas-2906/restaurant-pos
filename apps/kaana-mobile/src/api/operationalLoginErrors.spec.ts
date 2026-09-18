import { describe, expect, it } from "vitest";
import {
  OperationalAccessDeniedError,
  OperationalNetworkError,
  INTERNET_REQUIRED_FIRST_MESSAGE,
  accessDeniedMessage,
  resolveOperationalLoginFailure,
} from "./operationalLoginErrors";

describe("resolveOperationalLoginFailure", () => {
  it("maps healthy API + wrong role to genuine access denied", () => {
    const result = resolveOperationalLoginFailure({
      error: new OperationalAccessDeniedError(),
      deviceLabel: "POS",
      hasOfflineCredential: false,
    });
    expect(result).toEqual({
      action: "access_denied",
      message: accessDeniedMessage("POS"),
    });
  });

  it("maps API unavailable + no offline verifier to internet-required message", () => {
    const result = resolveOperationalLoginFailure({
      error: new OperationalNetworkError(),
      deviceLabel: "POS",
      hasOfflineCredential: false,
    });
    expect(result).toEqual({
      action: "internet_required",
      message: INTERNET_REQUIRED_FIRST_MESSAGE,
    });
  });

  it("maps API unavailable + valid offline verifier to try_offline", () => {
    const result = resolveOperationalLoginFailure({
      error: new OperationalNetworkError(),
      deviceLabel: "POS",
      hasOfflineCredential: true,
    });
    expect(result).toEqual({ action: "try_offline" });
  });

  it("does not treat network failure as access denied when fetch throws", () => {
    const result = resolveOperationalLoginFailure({
      error: new TypeError("Failed to fetch"),
      deviceLabel: "POS",
      hasOfflineCredential: false,
    });
    expect(result.action).toBe("internet_required");
    expect(result.message).toBe(INTERNET_REQUIRED_FIRST_MESSAGE);
  });

  it("maps API unavailable + expired offline verifier to internet revalidation", () => {
    const result = resolveOperationalLoginFailure({
      error: new OperationalNetworkError(),
      deviceLabel: "POS",
      hasOfflineCredential: false,
    });
    expect(result).toEqual({
      action: "internet_required",
      message: INTERNET_REQUIRED_FIRST_MESSAGE,
    });
  });
});
