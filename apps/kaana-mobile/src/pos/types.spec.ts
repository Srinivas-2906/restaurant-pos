import { describe, expect, it } from "vitest";
import { ACTIVE_ORDER_STATUSES, canModifyItem, pendingItems } from "./types";
import type { OrderDetail } from "@kaana/api-client";

describe("POS order helpers", () => {
  it("maps active order statuses", () => {
    expect(ACTIVE_ORDER_STATUSES.has("open")).toBe(true);
    expect(ACTIVE_ORDER_STATUSES.has("settled")).toBe(false);
  });

  it("finds pending items before KOT", () => {
    const order = {
      items: [
        { id: "1", status: "pending", kotId: null },
        { id: "2", status: "kot_fired", kotId: "k1" },
      ],
    } as OrderDetail;
    expect(pendingItems(order)).toHaveLength(1);
  });

  it("blocks modification after KOT fired", () => {
    expect(canModifyItem({ status: "pending", kotId: null })).toBe(true);
    expect(canModifyItem({ status: "pending", kotId: "k1" })).toBe(false);
  });
});
