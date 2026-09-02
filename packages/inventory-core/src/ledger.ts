import type { LedgerWriteInput } from "./types";

export interface LedgerResult {
  balanceAfter: number;
  totalValue?: number;
}

export function computeBalanceAfter(currentStock: number, quantity: number): number {
  return currentStock + quantity;
}

export function computeTotalValue(quantity: number, unitCost?: number): number | undefined {
  if (unitCost == null) return undefined;
  return Math.abs(quantity) * unitCost;
}

export function validateLedgerInput(input: LedgerWriteInput): void {
  if (!input.outletId) throw new Error("outletId is required");
  if (!input.ingredientId) throw new Error("ingredientId is required");
  if (!input.type) throw new Error("movement type is required");
  if (input.quantity === 0) throw new Error("quantity cannot be zero");
}

export function isInboundMovement(type: string): boolean {
  return [
    "opening_stock", "purchase", "supplier_free", "transfer_in",
    "production_output", "commit_release", "return",
  ].includes(type);
}

export function isOutboundMovement(type: string): boolean {
  return [
    "recipe_consumption", "sale", "wastage", "transfer_out",
    "production_consumption", "purchase_return", "committed_out",
    "expiry_writeoff", "staff_meal", "complimentary", "sample",
  ].includes(type);
}

export function formatLedgerReference(parts: string[]): string {
  return parts.filter(Boolean).join(":");
}
