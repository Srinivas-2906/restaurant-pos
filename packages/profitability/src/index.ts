export interface MarginInput {
  orderId: string;
  outletId: string;
  revenue: number;
  ingredientCost: number;
  packagingCost?: number;
  aggregatorCommission?: number;
  discountAmount?: number;
  paymentFee?: number;
  laborAllocation?: number;
  wastageAllocation?: number;
}

export interface MarginResult {
  contributionMargin: number;
  marginPercent: number;
  breakdown: Record<string, number>;
}

export function calculateOrderMargin(input: MarginInput): MarginResult {
  const packaging = input.packagingCost ?? 0;
  const aggregator = input.aggregatorCommission ?? 0;
  const discount = input.discountAmount ?? 0;
  const paymentFee = input.paymentFee ?? 0;
  const labor = input.laborAllocation ?? 0;
  const wastage = input.wastageAllocation ?? 0;

  const totalCost = input.ingredientCost + packaging + aggregator + discount + paymentFee + labor + wastage;
  const contributionMargin = input.revenue - totalCost;
  const marginPercent = input.revenue > 0 ? (contributionMargin / input.revenue) * 100 : 0;

  return {
    contributionMargin: Math.round(contributionMargin * 100) / 100,
    marginPercent: Math.round(marginPercent * 100) / 100,
    breakdown: {
      revenue: input.revenue,
      ingredientCost: input.ingredientCost,
      packagingCost: packaging,
      aggregatorCommission: aggregator,
      discountAmount: discount,
      paymentFee,
      laborAllocation: labor,
      wastageAllocation: wastage,
    },
  };
}

export function rankItemsByMargin(items: Array<{ name: string; margin: number; orders: number }>) {
  return [...items].sort((a, b) => b.margin - a.margin);
}

export function findLossMakingCombos(items: Array<{ name: string; margin: number }>, threshold = 0) {
  return items.filter((i) => i.margin < threshold);
}
