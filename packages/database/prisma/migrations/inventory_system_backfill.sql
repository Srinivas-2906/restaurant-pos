-- Inventory system schema backfill (run after prisma db push)
-- Backfill reorderLevel/targetStock from legacy minStock/parStock
UPDATE "Ingredient"
SET
  "reorderLevel" = CASE WHEN "reorderLevel" = 0 THEN "minStock" ELSE "reorderLevel" END,
  "targetStock" = CASE WHEN "targetStock" = 0 THEN "parStock" ELSE "targetStock" END,
  "weightedAverageCost" = CASE WHEN "weightedAverageCost" = 0 THEN "costPerUnit" ELSE "weightedAverageCost" END,
  "lastPurchaseCost" = CASE WHEN "lastPurchaseCost" = 0 THEN "costPerUnit" ELSE "lastPurchaseCost" END
WHERE "reorderLevel" = 0 OR "targetStock" = 0 OR "weightedAverageCost" = 0;
