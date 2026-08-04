export interface RecommendationDraft {
  outletId: string;
  type: "demand_forecast" | "prep_plan" | "po_draft" | "shift_suggestion" | "price_fix";
  title: string;
  prediction: string;
  proposedActions: string[];
  confidence: number;
}

export interface RecommendationOutcome {
  recommendationId: string;
  predictedValue: number;
  actualValue: number;
  variance: number;
  notes?: string;
}

export function createRecommendation(draft: RecommendationDraft) {
  return {
    ...draft,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
}

export function evaluateOutcome(predicted: number, actual: number): RecommendationOutcome["variance"] {
  if (predicted === 0) return actual === 0 ? 0 : 100;
  return Math.round(((actual - predicted) / predicted) * 10000) / 100;
}

export function generateDemandForecast(historicalOrders: number[], dayOfWeek: number): RecommendationDraft {
  const sameDay = historicalOrders.filter((_, i) => i % 7 === dayOfWeek);
  const avg = sameDay.length ? sameDay.reduce((a, b) => a + b, 0) / sameDay.length : historicalOrders.at(-1) ?? 0;
  const forecast = Math.ceil(avg * 1.1);
  return {
    outletId: "",
    type: "demand_forecast",
    title: "Tomorrow's demand forecast",
    prediction: `Expected ${forecast} orders based on ${sameDay.length} similar days`,
    proposedActions: [
      `Prep ${Math.ceil(forecast * 0.3)} kg base ingredients`,
      `Draft PO for ${Math.ceil(forecast * 0.15)} units high-turnover items`,
      `Suggest ${Math.ceil(forecast / 20)} extra floor staff`,
    ],
    confidence: sameDay.length >= 3 ? 0.85 : 0.6,
  };
}
