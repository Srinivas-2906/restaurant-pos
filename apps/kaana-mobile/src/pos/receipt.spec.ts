import { describe, expect, it } from "vitest";
import { buildReceiptData } from "./receipt";
import type { OrderDetail } from "@kaana/api-client";

const sampleOrder: OrderDetail = {
  id: "o1",
  orderNumber: "ORD-001",
  status: "settled",
  type: "takeaway",
  subtotal: 640,
  taxAmount: 32,
  totalAmount: 672,
  discountAmount: 0,
  createdAt: "2026-09-06T10:00:00.000Z",
  settledAt: "2026-09-06T10:05:00.000Z",
  items: [
    {
      id: "i1",
      name: "Chicken Biryani",
      quantity: 2,
      unitPrice: 320,
      taxAmount: 32,
      totalPrice: 640,
      status: "served",
      menuItemId: "m1",
    },
  ],
  table: null,
};

describe("receipt adapter", () => {
  it("builds receipt view-model from order", () => {
    const receipt = buildReceiptData(sampleOrder, {
      restaurantName: "Demo Restaurant",
      outletName: "Main Outlet",
      paymentMethod: "cash",
      paymentAmount: 700,
    });
    expect(receipt.billNumber).toBe("ORD-001");
    expect(receipt.items).toHaveLength(1);
    expect(receipt.total).toBe(672);
    expect(receipt.paymentMethod).toBe("cash");
    expect(receipt.restaurantName).toBe("Demo Restaurant");
  });
});
