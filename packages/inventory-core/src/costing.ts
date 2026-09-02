import { calculateWeightedAverageCost } from "./units";

export interface CostSnapshot {
  lastPurchaseCost: number;
  weightedAverageCost: number;
  previousPurchaseCost: number;
  costChangePct: number;
  costPerUnit: number;
}

export function updateCostOnReceipt(
  current: { currentStock: number; weightedAverageCost: number; lastPurchaseCost: number },
  receivedQty: number,
  unitCost: number,
): CostSnapshot {
  const existingQty = Math.max(0, current.currentStock);
  const existingCost = Number(current.weightedAverageCost) || Number(current.lastPurchaseCost) || 0;
  const wac = calculateWeightedAverageCost(existingQty, existingCost, receivedQty, unitCost);
  const previous = Number(current.lastPurchaseCost) || existingCost;
  const costChangePct = previous > 0 ? ((unitCost - previous) / previous) * 100 : 0;

  return {
    lastPurchaseCost: unitCost,
    weightedAverageCost: wac,
    previousPurchaseCost: previous,
    costChangePct,
    costPerUnit: wac,
  };
}

export function calculateRecipeCost(
  ingredients: Array<{ quantity: number; unitCost: number; lossPct?: number }>,
): number {
  return ingredients.reduce((sum, ing) => {
    const gross = ing.quantity * (1 + (ing.lossPct ?? 0) / 100);
    return sum + gross * ing.unitCost;
  }, 0);
}

export function calculateReorderSuggestion(params: {
  forecastDemand: number;
  available: number;
  incoming: number;
  safetyStock: number;
  targetStock?: number;
}): number {
  const needed = params.forecastDemand + params.safetyStock - params.available - params.incoming;
  if (needed <= 0) return 0;
  if (params.targetStock && params.available + params.incoming < params.targetStock) {
    return Math.max(needed, params.targetStock - params.available - params.incoming);
  }
  return needed;
}
