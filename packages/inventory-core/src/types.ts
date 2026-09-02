export type ItemType =
  | "raw_ingredient"
  | "semi_prepared"
  | "finished_stock"
  | "packaging"
  | "operating_supply"
  | "beverage";

export type UnitDimension = "weight" | "volume" | "count" | "length" | "custom_package";

export type NegativeStockPolicy = "block" | "warn" | "allow";

export type StockMovementType =
  | "opening_stock"
  | "purchase"
  | "purchase_return"
  | "recipe_consumption"
  | "sale"
  | "committed_out"
  | "commit_release"
  | "wastage"
  | "transfer_in"
  | "transfer_out"
  | "production_consumption"
  | "production_output"
  | "stock_count_adjustment"
  | "adjustment"
  | "return"
  | "expiry_writeoff"
  | "supplier_free"
  | "staff_meal"
  | "complimentary"
  | "sample";

export type WastageCategory =
  | "spoilage"
  | "expired"
  | "kitchen_loss"
  | "burnt"
  | "customer_return"
  | "spillage"
  | "breakage"
  | "quality_rejection"
  | "staff_error"
  | "trial_sample"
  | "unexplained";

export type CountType = "opening" | "closing" | "full" | "category" | "location" | "cycle" | "surprise_audit";

export const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: "raw_ingredient", label: "Raw ingredient" },
  { value: "semi_prepared", label: "Semi-prepared item" },
  { value: "finished_stock", label: "Finished stock item" },
  { value: "packaging", label: "Packaging" },
  { value: "operating_supply", label: "Operating supply" },
  { value: "beverage", label: "Beverage" },
];

export const DEFAULT_CATEGORIES = [
  "Vegetables", "Fruits", "Dairy", "Meat", "Seafood", "Grains", "Spices",
  "Oils", "Beverages", "Frozen", "Bakery", "Packaging", "Cleaning", "Miscellaneous",
];

export const STOCK_UNITS = ["kg", "litre", "piece", "gram", "ml"];
export const PURCHASE_UNITS = ["bag", "box", "crate", "bottle", "tray", "packet", "kg", "litre", "piece"];
export const CONSUMPTION_UNITS = ["gram", "ml", "piece", "kg", "litre"];

export interface ItemUnitConversion {
  fromUnit: string;
  toUnit: string;
  factor: number;
  dimension: UnitDimension;
}

export interface ItemUnitContext {
  stockUnit: string;
  consumptionUnit?: string | null;
  purchaseUnit?: string | null;
  purchaseToStockFactor?: number | null;
  stockToConsumptionFactor?: number | null;
  conversions?: ItemUnitConversion[];
}

export interface LedgerWriteInput {
  outletId: string;
  ingredientId: string;
  type: StockMovementType;
  quantity: number;
  reference?: string;
  notes?: string;
  reason?: string;
  createdById?: string;
  batchId?: string;
  unitCost?: number;
  sourceLocationId?: string;
  destLocationId?: string;
}

export interface StockAvailability {
  ingredientId: string;
  name: string;
  onHand: number;
  committed: number;
  available: number;
  reorderLevel: number;
  unit: string;
}

export interface MenuAvailabilityItem {
  menuItemId: string;
  name: string;
  canProduce: boolean;
  missingIngredients: Array<{ name: string; needed: number; available: number; unit: string }>;
}

export interface ReorderSuggestion {
  ingredientId: string;
  name: string;
  suggestedQty: number;
  unit: string;
  explanation: {
    forecastDemand: number;
    available: number;
    incoming: number;
    safetyStock: number;
    leadTimeDays: number;
  };
}
