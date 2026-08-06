"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

interface Recipe {
  menuItemId: string;
  name: string;
  ingredients: Array<{ name: string; quantity: number; unit: string }>;
}

export function RecipesModule() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const outletId = getOutletId();

  useEffect(() => {
    if (!outletId) return;
    api<Recipe[]>(`/inventory/outlets/${outletId}/recipes`).then(setRecipes).catch(() => setRecipes([]));
  }, [outletId]);

  return (
    <PageContent>
      <PageHeader title="Item recipes" description="Menu items linked to raw material consumption." />
      <InventoryNav />
      {recipes.length === 0 ? (
        <Panel><EmptyState title="No recipes" description="Recipes are created when menu items are linked to ingredients." /></Panel>
      ) : (
        recipes.map((r) => (
          <Panel key={r.menuItemId} className="mb-4">
            <h3 className="font-semibold mb-3">{r.name}</h3>
            <ul className="divide-y divide-gray-100 text-sm">
              {r.ingredients.map((ing, i) => (
                <li key={i} className="py-2 flex justify-between">
                  <span>{ing.name}</span>
                  <span className="text-gray-500">{ing.quantity} {ing.unit}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}
    </PageContent>
  );
}
