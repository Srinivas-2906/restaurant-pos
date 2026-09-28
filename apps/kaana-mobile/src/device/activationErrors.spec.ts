import { describe, expect, it } from "vitest";
import { mapActivationError, mapPinLoginError } from "../device/activationErrors";
import { OperationalAccessDeniedError } from "../api/operationalLoginErrors";

describe("activationErrors", () => {
  it("maps expired codes safely", () => {
    expect(mapActivationError(new Error("Invalid or expired activation code"))).toContain("expired");
  });

  it("maps PIN access denial without internals", () => {
    expect(
      mapPinLoginError(new OperationalAccessDeniedError(), "POS"),
    ).toBe("You don't have access to POS on this device.");
  });

  it("maps invalid PIN safely", () => {
    expect(mapPinLoginError(new Error("Invalid employee or PIN"), "KDS")).toBe(
      "Invalid employee ID or PIN.",
    );
  });
});
