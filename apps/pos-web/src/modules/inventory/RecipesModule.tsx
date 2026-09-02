"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";
import { FieldLabel, inputClass, selectClass } from "@/components/inventory/FormSection";
import { formatCurrency } from "@kaana/ui";

interface Recipe {
  id: string;
  menuItemId: string;
  name: string;
  yieldQty: number;
  version: number;
  recipeCost: number;
  ingredients: Array<{ id: string; ingredientId: string; name: string; quantity: number; unit: string; lossPct: number; isOptional: boolean }>;
}

interface MenuItem { id: string; name: string; }
interface Ingredient { id: string; name: string; unit: string; consumptionUnit?: string | null; }

export function RecipesModule() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [open, setOpen] = useState(false);
  const [menuItemId, setMenuItemId] = useState("");
  const [yieldQty, setYieldQty] = useState("1");
  const [lines, setLines] = useState([{ ingredientId: "", quantity: 0, lossPct: 0, consumptionUnit: "" }]);
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<Recipe[]>(`/inventory/outlets/${outletId}/recipes`).then(setRecipes).catch(() => setRecipes([]));
  }

  useEffect(() => {
    if (!outletId) return;
    load();
    api<{ categories: Array<{ items: MenuItem[] }> }>(`/menu/outlets/${outletId}/menu`).then((menu) => {
      setMenuItems(menu.categories?.flatMap((c) => c.items) ?? []);
    }).catch(() => setMenuItems([]));
    api<Ingredient[]>(`/inventory/outlets/${outletId}/items`).then(setIngredients);
  }, [outletId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      await api(`/inventory/outlets/${outletId}/recipes`, {
        method: "POST",
        body: JSON.stringify({
          menuItemId,
          yieldQty: Number(yieldQty),
          ingredients: lines.filter((l) => l.ingredientId).map((l) => ({
            ingredientId: l.ingredientId,
            quantity: l.quantity,
            lossPct: l.lossPct,
            consumptionUnit: l.consumptionUnit || undefined,
          })),
        }),
      });
      setOpen(false);
      setMsg("Recipe saved");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  const unmapped = menuItems.filter((m) => !recipes.some((r) => r.menuItemId === m.id));

  return (
    <PageContent>
      <PageHeader
        title="Recipes"
        description="Link menu items to ingredient consumption for automatic stock deduction."
        action={
          <button type="button" onClick={() => setOpen(true)} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
            {recipes.length ? "Edit recipe" : "Create recipe"}
          </button>
        }
      />
      <InventoryNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      {unmapped.length > 0 && (
        <Panel title={`${unmapped.length} menu items without recipes`} className="mb-4">
          <p className="text-sm text-amber-800">{unmapped.slice(0, 5).map((m) => m.name).join(", ")}{unmapped.length > 5 ? "…" : ""}</p>
        </Panel>
      )}

      {recipes.length === 0 ? (
        <Panel><EmptyState title="No recipes" description="Create recipes to enable automatic POS stock deduction." /></Panel>
      ) : (
        recipes.map((r) => (
          <Panel key={r.menuItemId} className="mb-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold">{r.name}</h3>
                <p className="text-sm text-gray-500">Yield: {r.yieldQty} · v{r.version} · Cost: {formatCurrency(r.recipeCost)}</p>
              </div>
              <button type="button" onClick={() => { setMenuItemId(r.menuItemId); setYieldQty(String(r.yieldQty)); setLines(r.ingredients.map((i) => ({ ingredientId: i.ingredientId, quantity: i.quantity, lossPct: i.lossPct, consumptionUnit: i.unit }))); setOpen(true); }} className="text-kaana text-sm hover:underline">Edit</button>
            </div>
            <ul className="divide-y divide-gray-100 text-sm">
              {r.ingredients.map((ing) => (
                <li key={ing.id} className="py-2 flex justify-between">
                  <span>{ing.name}{ing.isOptional ? " (optional)" : ""}</span>
                  <span className="text-gray-500">{ing.quantity} {ing.unit}{ing.lossPct > 0 ? ` (+${ing.lossPct}% loss)` : ""}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}

      <SlideOver
        open={open}
        title="Recipe"
        onClose={() => setOpen(false)}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border text-sm">Cancel</button>
            <button type="submit" form="recipe-form" className="px-4 py-2 rounded-xl bg-kaana text-white text-sm font-medium">Save recipe</button>
          </div>
        }
      >
        <form id="recipe-form" onSubmit={save} className="space-y-4">
          <div>
            <FieldLabel required>Menu item</FieldLabel>
            <select value={menuItemId} onChange={(e) => setMenuItemId(e.target.value)} className={selectClass} required>
              <option value="">Select…</option>
              {menuItems.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Yield (portions)</FieldLabel>
            <input type="number" min={1} value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} className={inputClass} />
          </div>
          <p className="text-sm font-medium">Ingredients</p>
          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1">
                <select value={line.ingredientId} onChange={(e) => { const n = [...lines]; n[idx].ingredientId = e.target.value; setLines(n); }} className={selectClass}>
                  <option value="">Item…</option>
                  {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <input type="number" step="0.001" value={line.quantity} onChange={(e) => { const n = [...lines]; n[idx].quantity = Number(e.target.value); setLines(n); }} className="w-20 border rounded-xl px-2 py-2.5" placeholder="Qty" />
              <input type="number" step="0.1" value={line.lossPct} onChange={(e) => { const n = [...lines]; n[idx].lossPct = Number(e.target.value); setLines(n); }} className="w-16 border rounded-xl px-2 py-2.5" placeholder="Loss%" />
            </div>
          ))}
          <button type="button" onClick={() => setLines([...lines, { ingredientId: "", quantity: 0, lossPct: 0, consumptionUnit: "" }])} className="text-sm text-kaana font-medium">+ Add ingredient</button>
        </form>
      </SlideOver>
    </PageContent>
  );
}
