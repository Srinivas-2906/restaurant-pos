import type { ItemUnitContext, ItemUnitConversion, UnitDimension } from "./types";

const DIMENSION_UNITS: Record<UnitDimension, Record<string, number>> = {
  weight: { mg: 0.001, g: 1, gram: 1, gm: 1, kg: 1000, quintal: 100000 },
  volume: { ml: 1, litre: 1000, ltr: 1000, l: 1000 },
  count: { piece: 1, dozen: 12, pcs: 1 },
  length: { cm: 1, metre: 100, m: 100 },
  custom_package: {},
};

const UNIT_DIMENSION_MAP: Record<string, UnitDimension> = {};
for (const [dim, units] of Object.entries(DIMENSION_UNITS)) {
  for (const u of Object.keys(units)) {
    UNIT_DIMENSION_MAP[u.toLowerCase()] = dim as UnitDimension;
  }
}
for (const u of ["bag", "box", "crate", "bottle", "tray", "packet"]) {
  UNIT_DIMENSION_MAP[u] = "custom_package";
}

export function getUnitDimension(unit: string): UnitDimension | null {
  return UNIT_DIMENSION_MAP[unit.toLowerCase()] ?? null;
}

export function normalizeUnit(unit: string): string {
  const map: Record<string, string> = {
    gm: "gram", g: "gram", ltr: "litre", l: "litre", pcs: "piece",
  };
  return map[unit.toLowerCase()] ?? unit.toLowerCase();
}

function convertWithinDimension(fromUnit: string, toUnit: string, qty: number): number | null {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return qty;

  const dim = getUnitDimension(from);
  if (!dim || dim !== getUnitDimension(to)) return null;

  const table = DIMENSION_UNITS[dim];
  const fromFactor = table[from];
  const toFactor = table[to];
  if (fromFactor == null || toFactor == null) return null;

  return (qty * fromFactor) / toFactor;
}

function findConversionChain(
  ctx: ItemUnitContext,
  fromUnit: string,
  toUnit: string,
): number | null {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return 1;

  const conversions = ctx.conversions ?? [];
  for (const c of conversions) {
    if (normalizeUnit(c.fromUnit) === from && normalizeUnit(c.toUnit) === to) {
      return c.factor;
    }
    if (normalizeUnit(c.fromUnit) === to && normalizeUnit(c.toUnit) === from) {
      return 1 / c.factor;
    }
  }

  // BFS through conversion graph
  const graph = new Map<string, Array<{ unit: string; factor: number }>>();
  for (const c of conversions) {
    const f = normalizeUnit(c.fromUnit);
    const t = normalizeUnit(c.toUnit);
    if (!graph.has(f)) graph.set(f, []);
    if (!graph.has(t)) graph.set(t, []);
    graph.get(f)!.push({ unit: t, factor: c.factor });
    graph.get(t)!.push({ unit: f, factor: 1 / c.factor });
  }

  const queue: Array<{ unit: string; factor: number }> = [{ unit: from, factor: 1 }];
  const visited = new Set<string>([from]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.unit === to) return current.factor;
    for (const edge of graph.get(current.unit) ?? []) {
      if (visited.has(edge.unit)) continue;
      visited.add(edge.unit);
      queue.push({ unit: edge.unit, factor: current.factor * edge.factor });
    }
  }

  return null;
}

export function toStockUnit(ctx: ItemUnitContext, qty: number, fromUnit: string): number {
  const stockUnit = normalizeUnit(ctx.stockUnit);
  const from = normalizeUnit(fromUnit);

  if (from === stockUnit) return qty;

  const purchaseUnit = ctx.purchaseUnit ? normalizeUnit(ctx.purchaseUnit) : null;
  if (purchaseUnit && from === purchaseUnit && ctx.purchaseToStockFactor) {
    return qty * ctx.purchaseToStockFactor;
  }

  const chain = findConversionChain(ctx, from, stockUnit);
  if (chain != null) return qty * chain;

  const dimConvert = convertWithinDimension(from, stockUnit, qty);
  if (dimConvert != null) return dimConvert;

  throw new Error(`Cannot convert ${qty} ${fromUnit} to stock unit ${ctx.stockUnit}`);
}

export function toConsumptionUnit(ctx: ItemUnitContext, stockQty: number): number {
  const consumptionUnit = ctx.consumptionUnit ? normalizeUnit(ctx.consumptionUnit) : normalizeUnit(ctx.stockUnit);
  const stockUnit = normalizeUnit(ctx.stockUnit);

  if (consumptionUnit === stockUnit) return stockQty;

  if (ctx.stockToConsumptionFactor) {
    return stockQty * ctx.stockToConsumptionFactor;
  }

  const dimConvert = convertWithinDimension(stockUnit, consumptionUnit, stockQty);
  if (dimConvert != null) return dimConvert;

  return stockQty;
}

export function fromConsumptionToStock(ctx: ItemUnitContext, consumptionQty: number): number {
  const consumptionUnit = ctx.consumptionUnit ? normalizeUnit(ctx.consumptionUnit) : normalizeUnit(ctx.stockUnit);
  const stockUnit = normalizeUnit(ctx.stockUnit);

  if (consumptionUnit === stockUnit) return consumptionQty;

  if (ctx.stockToConsumptionFactor && ctx.stockToConsumptionFactor !== 0) {
    return consumptionQty / ctx.stockToConsumptionFactor;
  }

  const dimConvert = convertWithinDimension(consumptionUnit, stockUnit, consumptionQty);
  if (dimConvert != null) return dimConvert;

  return consumptionQty;
}

export function applyLossPct(qty: number, lossPct: number): number {
  if (lossPct <= 0) return qty;
  return qty * (1 + lossPct / 100);
}

export function buildDefaultConversions(ctx: {
  stockUnit: string;
  consumptionUnit?: string | null;
  purchaseUnit?: string | null;
  purchaseToStockFactor?: number | null;
  stockToConsumptionFactor?: number | null;
}): ItemUnitConversion[] {
  const conversions: ItemUnitConversion[] = [];

  if (ctx.purchaseUnit && ctx.purchaseToStockFactor) {
    conversions.push({
      fromUnit: ctx.purchaseUnit,
      toUnit: ctx.stockUnit,
      factor: ctx.purchaseToStockFactor,
      dimension: getUnitDimension(ctx.purchaseUnit) ?? "custom_package",
    });
  }

  if (ctx.consumptionUnit && ctx.stockToConsumptionFactor) {
    conversions.push({
      fromUnit: ctx.stockUnit,
      toUnit: ctx.consumptionUnit,
      factor: ctx.stockToConsumptionFactor,
      dimension: getUnitDimension(ctx.consumptionUnit) ?? "weight",
    });
  }

  return conversions;
}

export function calculateWeightedAverageCost(
  existingQty: number,
  existingCost: number,
  incomingQty: number,
  incomingCost: number,
): number {
  const totalQty = existingQty + incomingQty;
  if (totalQty <= 0) return incomingCost;
  return (existingQty * existingCost + incomingQty * incomingCost) / totalQty;
}
