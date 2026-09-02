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

export const ITEM_TYPES = [
  { value: "raw_ingredient" as const, label: "Raw ingredient" },
  { value: "semi_prepared" as const, label: "Semi-prepared item" },
  { value: "finished_stock" as const, label: "Finished stock item" },
  { value: "packaging" as const, label: "Packaging" },
  { value: "operating_supply" as const, label: "Operating supply" },
  { value: "beverage" as const, label: "Beverage" },
];

export const DEFAULT_CATEGORIES = [
  "Vegetables", "Fruits", "Dairy", "Meat", "Seafood", "Grains", "Spices",
  "Oils", "Beverages", "Frozen", "Bakery", "Packaging", "Cleaning", "Miscellaneous",
];

export const WASTAGE_CATEGORIES = [
  { value: "spoilage" as const, label: "Spoilage" },
  { value: "expired" as const, label: "Expired" },
  { value: "kitchen_loss" as const, label: "Kitchen preparation loss" },
  { value: "burnt" as const, label: "Burnt / overcooked" },
  { value: "customer_return" as const, label: "Customer return" },
  { value: "spillage" as const, label: "Spillage" },
  { value: "breakage" as const, label: "Breakage" },
  { value: "quality_rejection" as const, label: "Quality rejection" },
  { value: "staff_error" as const, label: "Staff error" },
  { value: "trial_sample" as const, label: "Trial / sample" },
  { value: "unexplained" as const, label: "Unexplained shortage" },
];

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  opening_stock: "Opening stock",
  purchase: "Purchase receipt",
  purchase_return: "Purchase return",
  recipe_consumption: "Recipe consumption",
  sale: "POS sale",
  committed_out: "KOT committed",
  commit_release: "Commit released",
  wastage: "Wastage",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  production_consumption: "Production input",
  production_output: "Production output",
  stock_count_adjustment: "Stock count adjustment",
  adjustment: "Manual adjustment",
  return: "Return",
  expiry_writeoff: "Expiry write-off",
  supplier_free: "Supplier free qty",
  staff_meal: "Staff meal",
  complimentary: "Complimentary",
  sample: "Sample",
};
