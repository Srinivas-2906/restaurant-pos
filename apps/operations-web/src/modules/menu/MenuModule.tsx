"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { api, getOutletId } from "@/lib/api";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";
import { formatCurrency } from "@kaana/ui";

interface MenuItemRow {
  id: string;
  name: string;
  nameHi?: string | null;
  basePrice: number | string;
  price: number | string;
  isAvailable: boolean;
  isVeg: boolean;
  variants?: Array<{ id: string; name: string; priceDelta: number | string }>;
}

interface CategoryRow {
  id: string;
  name: string;
  nameHi?: string | null;
  items: MenuItemRow[];
}

interface MenuRow {
  id: string;
  name: string;
  categories: CategoryRow[];
}

const emptyCategoryForm = { name: "", nameHi: "" };
const emptyItemForm = {
  name: "",
  nameHi: "",
  basePrice: "",
  isVeg: true,
  hsnCode: "",
};

function VegBadge({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded-sm border-2 shrink-0 ${
        isVeg ? "border-emerald-600" : "border-red-600"
      }`}
      title={isVeg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? "bg-emerald-600" : "bg-red-600"}`} />
    </span>
  );
}

export function MenuModule() {
  const outletId = getOutletId();
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);

  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItemForm);

  const activeMenu = menus[0] ?? null;

  const categories = activeMenu?.categories ?? [];

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? categories[0] ?? null,
    [categories, selectedCategoryId],
  );

  const filteredItems = useMemo(() => {
    if (!selectedCategory) return [];
    const q = search.trim().toLowerCase();
    if (!q) return selectedCategory.items;
    return selectedCategory.items.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.nameHi?.toLowerCase().includes(q) ?? false),
    );
  }, [selectedCategory, search]);

  const load = useCallback(async () => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api<MenuRow[]>(`/outlets/${outletId}/menu`);
      setMenus(data);
      const firstCat = data[0]?.categories[0]?.id ?? null;
      setSelectedCategoryId((prev) => {
        if (prev && data.some((m) => m.categories.some((c) => c.id === prev))) return prev;
        return firstCat;
      });
    } catch {
      setMenus([]);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAvailability(item: MenuItemRow) {
    if (!outletId) return;
    try {
      await api(`/outlets/${outletId}/items/${item.id}/availability`, {
        method: "PATCH",
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      setMsg(item.isAvailable ? `${item.name} marked unavailable` : `${item.name} is available again`);
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not update availability");
    }
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!activeMenu) return;
    try {
      await api(`/menus/${activeMenu.id}/categories`, {
        method: "POST",
        body: JSON.stringify({
          name: categoryForm.name,
          nameHi: categoryForm.nameHi || undefined,
        }),
      });
      setCategoryOpen(false);
      setCategoryForm(emptyCategoryForm);
      setMsg("Category added");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to add category");
    }
  }

  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCategory) return;
    try {
      await api("/menu-items", {
        method: "POST",
        body: JSON.stringify({
          categoryId: selectedCategory.id,
          name: itemForm.name,
          nameHi: itemForm.nameHi || undefined,
          basePrice: Number(itemForm.basePrice),
          isVeg: itemForm.isVeg,
          hsnCode: itemForm.hsnCode || undefined,
        }),
      });
      setItemOpen(false);
      setItemForm(emptyItemForm);
      setMsg("Item added");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to add item");
    }
  }

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
  const unavailableCount = categories.reduce(
    (sum, c) => sum + c.items.filter((i) => !i.isAvailable).length,
    0,
  );

  if (!outletId) {
    return (
      <PageContent>
        <PageHeader title="Menu" description="Manage menu categories and items." />
        <Panel>
          <EmptyState title="No outlet selected" description="Sign in with an outlet role or select an outlet." />
        </Panel>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageHeader
        title="Menu"
        description={
          activeMenu
            ? `${activeMenu.name} · ${categories.length} categories · ${totalItems} items${
                unavailableCount > 0 ? ` · ${unavailableCount} unavailable` : ""
              }`
            : "Manage menu categories and items."
        }
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryOpen(true)}
              disabled={!activeMenu}
              className="border border-gray-200 hover:bg-gray-50 text-gray-800 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              Add category
            </button>
            <button
              type="button"
              onClick={() => setItemOpen(true)}
              disabled={!selectedCategory}
              className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              Add item
            </button>
          </div>
        }
      />

      {msg && (
        <p className="text-sm mb-4 text-green-700" role="status">
          {msg}
        </p>
      )}

      {loading ? (
        <Panel>
          <div className="py-12 text-center text-sm text-gray-500">Loading menu…</div>
        </Panel>
      ) : !activeMenu || categories.length === 0 ? (
        <Panel>
          <EmptyState
            title="No menu yet"
            description="Add a category to start building your menu."
            action={
              <button
                type="button"
                onClick={() => setCategoryOpen(true)}
                className="mt-4 inline-flex items-center gap-2 bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add category
              </button>
            }
          />
        </Panel>
      ) : (
        <div className="grid lg:grid-cols-[240px_1fr] gap-6">
          <Panel title="Categories" className="h-fit">
            <ul className="divide-y divide-gray-100 -mx-5 -mb-5">
              {categories.map((cat) => {
                const active = cat.id === selectedCategory?.id;
                const off = cat.items.filter((i) => !i.isAvailable).length;
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`w-full text-left px-5 py-3 text-sm transition-colors ${
                        active ? "bg-kaana/10 text-kaana-dark font-semibold" : "hover:bg-gray-50 text-gray-800"
                      }`}
                    >
                      <span className="block truncate">{cat.name}</span>
                      <span className="text-xs text-gray-500 font-normal">
                        {cat.items.length} items
                        {off > 0 ? ` · ${off} off` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title={selectedCategory?.name ?? "Items"}>
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search items…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm"
              />
            </div>

            {filteredItems.length === 0 ? (
              <EmptyState
                title="No items"
                description={search ? "No items match your search." : "Add an item to this category."}
              />
            ) : (
              <div className="overflow-x-auto -mx-5 -mb-5">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-medium text-gray-600">Item</th>
                      <th className="text-left p-3 font-medium text-gray-600">Price</th>
                      <th className="text-left p-3 font-medium text-gray-600">Variants</th>
                      <th className="text-left p-3 font-medium text-gray-600">Status</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr key={item.id} className={`border-t border-gray-100 ${!item.isAvailable ? "opacity-60" : ""}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <VegBadge isVeg={item.isVeg} />
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              {item.nameHi && <p className="text-xs text-gray-500">{item.nameHi}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-medium">{formatCurrency(Number(item.price ?? item.basePrice))}</td>
                        <td className="p-3 text-gray-600">
                          {item.variants && item.variants.length > 0 ? item.variants.length : "—"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              item.isAvailable ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
                            }`}
                          >
                            {item.isAvailable ? "Available" : "Unavailable"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleAvailability(item)}
                            className="text-kaana text-sm font-medium hover:underline"
                          >
                            {item.isAvailable ? "Mark unavailable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      <SlideOver open={categoryOpen} title="Add category" onClose={() => setCategoryOpen(false)}>
        <form id="category-form" onSubmit={saveCategory} className="space-y-4">
          <label className="block text-sm">
            <span className="text-gray-600">Name</span>
            <input
              required
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2"
              placeholder="Starters"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Name (Hindi, optional)</span>
            <input
              value={categoryForm.nameHi}
              onChange={(e) => setCategoryForm({ ...categoryForm, nameHi: e.target.value })}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2"
            />
          </label>
        </form>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setCategoryOpen(false)} className="px-4 py-2 text-sm rounded-xl border">
            Cancel
          </button>
          <button type="submit" form="category-form" className="px-4 py-2 text-sm rounded-xl bg-kaana text-white font-medium">
            Save category
          </button>
        </div>
      </SlideOver>

      <SlideOver open={itemOpen} title={`Add item · ${selectedCategory?.name ?? ""}`} onClose={() => setItemOpen(false)} wide>
        <form id="item-form" onSubmit={saveItem} className="space-y-4">
          <label className="block text-sm">
            <span className="text-gray-600">Item name</span>
            <input
              required
              value={itemForm.name}
              onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Name (Hindi, optional)</span>
            <input
              value={itemForm.nameHi}
              onChange={(e) => setItemForm({ ...itemForm, nameHi: e.target.value })}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="text-gray-600">Base price (₹)</span>
              <input
                required
                type="number"
                min={1}
                step={1}
                value={itemForm.basePrice}
                onChange={(e) => setItemForm({ ...itemForm, basePrice: e.target.value })}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">HSN code (optional)</span>
              <input
                value={itemForm.hsnCode}
                onChange={(e) => setItemForm({ ...itemForm, hsnCode: e.target.value })}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={itemForm.isVeg}
              onChange={(e) => setItemForm({ ...itemForm, isVeg: e.target.checked })}
              className="rounded border-gray-300"
            />
            Vegetarian
          </label>
        </form>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setItemOpen(false)} className="px-4 py-2 text-sm rounded-xl border">
            Cancel
          </button>
          <button type="submit" form="item-form" className="px-4 py-2 text-sm rounded-xl bg-kaana text-white font-medium">
            Save item
          </button>
        </div>
      </SlideOver>
    </PageContent>
  );
}
