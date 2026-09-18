import { describe, expect, it } from "vitest";
import { formatInr, formatOrderStatus } from "./format";

describe("format", () => {
  it("formats INR values", () => {
    expect(formatInr(1250)).toContain("1,250");
    expect(formatInr(1250)).toContain("₹");
  });

  it("formats order status labels", () => {
    expect(formatOrderStatus("kot_fired")).toBe("Kot Fired");
  });
});
