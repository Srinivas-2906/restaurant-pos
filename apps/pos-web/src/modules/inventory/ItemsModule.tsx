"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";
import { FormSection, FieldLabel, inputClass, selectClass } from "@/components/inventory/FormSection";
import { formatCurrency } from "@kaana/ui";
import { ITEM_TYPES, DEFAULT_CATEGORIES } from "@kaana/shared-types";

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  itemType?: string;
  consumptionUnit?: string | null;
  purchaseUnit?: string | null;
  purchaseToStockFactor?: number | string | null;
  stockToConsumptionFactor?: number | string | null;
  currentStock: number | string;
  committedStock?: number | string;
  reorderLevel?: number | string;
  targetStock?: number | string;
  minStock?: number | string;
  parStock?: number | string;
  maxStock?: number | string;
  safetyStock?: number | string;
  leadTimeDays?: number;
  reorderQuantity?: number | string;
  negativeStockPolicy?: string;
  weightedAverageCost?: number | string;
  lastPurchaseCost?: number | string;
  sku?: string | null;
  barcode?: string | null;
  brand?: string | null;
  description?: string | null;
  isActive: boolean;
  isFavourite: boolean;
  isPerishable?: boolean;
  trackBatch?: boolean;
  trackExpiry?: boolean;
  storageLocation?: string | null;
  hsnCode?: string | null;
  minOrderQuantity?: number | string;
  yieldPct?: number | string;
  notes?: string | null;
  supplier?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
}

interface Category { id: string; name: string; }
interface Supplier { id: string; name: string; }

const emptyForm = {
  name: "",
  itemType: "raw_ingredient",
  unit: "kg",
  consumptionUnit: "gram",
  purchaseUnit: "bag",
  purchaseToStockFactor: "25",
  stockToConsumptionFactor: "1000",
  reorderLevel: "0",
  targetStock: "0",
  maxStock: "0",
  safetyStock: "0",
  leadTimeDays: "0",
  reorderQuantity: "0",
  negativeStockPolicy: "warn",
  categoryId: "",
  supplierId: "",
  sku: "",
  barcode: "",
  brand: "",
  description: "",
  storageLocation: "",
  isPerishable: false,
  trackBatch: false,
  trackExpiry: false,
  hsnCode: "",
  minOrderQuantity: "0",
  yieldPct: "100",
  notes: "",
  taxPct: "0",
  normalLossPct: "0",
  allowDecimal: true,
  isFavourite: false,
  isActive: true,
};

export function ItemsModule() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [openingQty, setOpeningQty] = useState("");
  const [openingCost, setOpeningCost] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<InventoryItem[]>(`/inventory/outlets/${outletId}/items`).then(setItems).catch(() => setItems([]));
    api<Category[]>(`/inventory/outlets/${outletId}/categories`).then(setCategories).catch(() => setCategories([]));
    api<Supplier[]>(`/inventory/outlets/${outletId}/suppliers`).then(setSuppliers).catch(() => setSuppliers([]));
  }

  useEffect(load, [outletId]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(item: InventoryItem) {
    setEditing(item);
    setForm({
      ...emptyForm,
      name: item.name,
      itemType: item.itemType ?? "raw_ingredient",
      unit: item.unit,
      consumptionUnit: item.consumptionUnit ?? "",
      purchaseUnit: item.purchaseUnit ?? "",
      purchaseToStockFactor: String(item.purchaseToStockFactor ?? ""),
      stockToConsumptionFactor: String(item.stockToConsumptionFactor ?? ""),
      reorderLevel: String(item.reorderLevel ?? item.minStock ?? "0"),
      targetStock: String(item.targetStock ?? item.parStock ?? "0"),
      maxStock: String(item.maxStock ?? "0"),
      safetyStock: String(item.safetyStock ?? "0"),
      leadTimeDays: String(item.leadTimeDays ?? "0"),
      reorderQuantity: String(item.reorderQuantity ?? "0"),
      negativeStockPolicy: item.negativeStockPolicy ?? "warn",
      categoryId: item.category?.id ?? "",
      supplierId: item.supplier?.id ?? "",
      sku: item.sku ?? "",
      barcode: item.barcode ?? "",
      brand: item.brand ?? "",
      description: item.description ?? "",
      storageLocation: item.storageLocation ?? "",
      isPerishable: item.isPerishable ?? false,
      trackBatch: item.trackBatch ?? false,
      trackExpiry: item.trackExpiry ?? false,
      hsnCode: item.hsnCode ?? "",
      minOrderQuantity: String(item.minOrderQuantity ?? "0"),
      yieldPct: String(item.yieldPct ?? "100"),
      notes: item.notes ?? "",
      isFavourite: item.isFavourite,
      isActive: item.isActive,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    const payload = {
      ...form,
      reorderLevel: Number(form.reorderLevel),
      targetStock: Number(form.targetStock),
      minStock: Number(form.reorderLevel),
      parStock: Number(form.targetStock),
      maxStock: Number(form.maxStock),
      safetyStock: Number(form.safetyStock),
      leadTimeDays: Number(form.leadTimeDays),
      reorderQuantity: Number(form.reorderQuantity),
      purchaseToStockFactor: form.purchaseToStockFactor ? Number(form.purchaseToStockFactor) : undefined,
      stockToConsumptionFactor: form.stockToConsumptionFactor ? Number(form.stockToConsumptionFactor) : undefined,
      minOrderQuantity: Number(form.minOrderQuantity),
      yieldPct: Number(form.yieldPct),
      taxPct: Number(form.taxPct),
      normalLossPct: Number(form.normalLossPct),
      categoryId: form.categoryId || undefined,
      supplierId: form.supplierId || undefined,
      consumptionUnit: form.consumptionUnit || undefined,
      purchaseUnit: form.purchaseUnit || undefined,
    };
    try {
      if (editing) {
        await api(`/inventory/items/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api(`/inventory/outlets/${outletId}/items`, { method: "POST", body: JSON.stringify(payload) });
      }
      setOpen(false);
      setMsg(editing ? "Item updated" : "Item created");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function addCategory() {
    if (!outletId || !newCategory.trim()) return;
    await api(`/inventory/outlets/${outletId}/categories`, {
      method: "POST",
      body: JSON.stringify({ name: newCategory.trim() }),
    });
    setNewCategory("");
    load();
  }

  async function saveOpeningStock(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId || !editing) return;
    try {
      await api(`/inventory/outlets/${outletId}/opening-stock`, {
        method: "POST",
        body: JSON.stringify({
          ingredientId: editing.id,
          quantity: Number(openingQty),
          unitCost: openingCost ? Number(openingCost) : undefined,
        }),
      });
      setOpeningOpen(false);
      setOpeningQty("");
      setOpeningCost("");
      setMsg("Opening stock recorded");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader
        title="Inventory Items"
        description="Manage ingredients, packaging, supplies and stock thresholds."
        action={
          <button type="button" onClick={openCreate} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
            Add item
          </button>
        }
      />
      <InventoryNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title={`Items (${items.length})`}>
        {items.length === 0 ? (
          <EmptyState title="No items" description="Add your first inventory item to track stock." />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Name</th>
                  <th className="text-left p-3 font-medium text-gray-600">Type</th>
                  <th className="text-left p-3 font-medium text-gray-600">Category</th>
                  <th className="text-left p-3 font-medium text-gray-600">Available</th>
                  <th className="text-left p-3 font-medium text-gray-600">Reorder / Target</th>
                  <th className="text-left p-3 font-medium text-gray-600">WAC</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const available = Number(i.currentStock) - Number(i.committedStock ?? 0);
                  const reorder = Number(i.reorderLevel ?? i.minStock);
                  const target = Number(i.targetStock ?? i.parStock);
                  return (
                    <tr key={i.id} className="border-t border-gray-100">
                      <td className="p-3 font-medium">{i.isFavourite ? "★ " : ""}{i.name}</td>
                      <td className="p-3 capitalize text-gray-600">{(i.itemType ?? "raw_ingredient").replace(/_/g, " ")}</td>
                      <td className="p-3">{i.category?.name ?? "—"}</td>
                      <td className={`p-3 ${available <= reorder ? "text-red-600 font-medium" : ""}`}>
                        {available.toFixed(2)} {i.unit}
                      </td>
                      <td className="p-3">{reorder} / {target}</td>
                      <td className="p-3">{formatCurrency(Number(i.weightedAverageCost ?? 0))}</td>
                      <td className="p-3 space-x-2">
                        <button type="button" onClick={() => openEdit(i)} className="text-kaana text-sm font-medium hover:underline">Edit</button>
                        <button type="button" onClick={() => { setEditing(i); setOpeningOpen(true); }} className="text-gray-600 text-sm hover:underline">Opening</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <SlideOver
        open={open}
        title={editing ? "Edit item" : "Add item"}
        onClose={() => setOpen(false)}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">Cancel</button>
            <button type="submit" form="item-form" className="px-4 py-2 rounded-xl bg-kaana text-white text-sm font-medium">Save</button>
          </div>
        }
      >
        <form id="item-form" onSubmit={save} className="space-y-4">
          <FormSection title="Basic information" defaultOpen>
            <div>
              <FieldLabel required>Item name</FieldLabel>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>Item type</FieldLabel>
                <select value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value })} className={selectClass}>
                  {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel required>Stock unit</FieldLabel>
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={selectClass}>
                  {["kg", "litre", "piece", "gram", "ml"].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <FieldLabel>Category</FieldLabel>
              <div className="flex gap-2">
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={selectClass}>
                  <option value="">Uncategorized</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category" className={inputClass} />
                <button type="button" onClick={addCategory} className="px-3 py-2 rounded-xl border text-sm whitespace-nowrap">Add</button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Suggested: {DEFAULT_CATEGORIES.slice(0, 5).join(", ")}…</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>SKU</FieldLabel><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={inputClass} /></div>
              <div><FieldLabel>Barcode</FieldLabel><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className={inputClass} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isFavourite} onChange={(e) => setForm({ ...form, isFavourite: e.target.checked })} /> Mark as favourite</label>
          </FormSection>

          <FormSection title="Units & conversions">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Purchase unit</FieldLabel>
                <select value={form.purchaseUnit} onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })} className={selectClass}>
                  {["bag", "box", "crate", "bottle", "tray", "packet", "kg", "litre"].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Purchase → stock factor</FieldLabel>
                <input type="number" step="0.0001" value={form.purchaseToStockFactor} onChange={(e) => setForm({ ...form, purchaseToStockFactor: e.target.value })} className={inputClass} placeholder="e.g. 25 (1 bag = 25 kg)" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Consumption unit</FieldLabel>
                <select value={form.consumptionUnit} onChange={(e) => setForm({ ...form, consumptionUnit: e.target.value })} className={selectClass}>
                  {["gram", "ml", "piece", "kg", "litre"].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Stock → consumption factor</FieldLabel>
                <input type="number" step="0.0001" value={form.stockToConsumptionFactor} onChange={(e) => setForm({ ...form, stockToConsumptionFactor: e.target.value })} className={inputClass} placeholder="e.g. 1000 (1 kg = 1000 g)" />
              </div>
            </div>
          </FormSection>

          <FormSection title="Stock control">
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>Reorder level</FieldLabel><input type="number" step="0.01" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} className={inputClass} /></div>
              <div><FieldLabel>Target stock</FieldLabel><input type="number" step="0.01" value={form.targetStock} onChange={(e) => setForm({ ...form, targetStock: e.target.value })} className={inputClass} /></div>
              <div><FieldLabel>Maximum stock</FieldLabel><input type="number" step="0.01" value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: e.target.value })} className={inputClass} /></div>
              <div><FieldLabel>Safety stock</FieldLabel><input type="number" step="0.01" value={form.safetyStock} onChange={(e) => setForm({ ...form, safetyStock: e.target.value })} className={inputClass} /></div>
              <div><FieldLabel>Lead time (days)</FieldLabel><input type="number" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} className={inputClass} /></div>
              <div><FieldLabel>Reorder quantity</FieldLabel><input type="number" step="0.01" value={form.reorderQuantity} onChange={(e) => setForm({ ...form, reorderQuantity: e.target.value })} className={inputClass} /></div>
            </div>
            <div>
              <FieldLabel>Negative stock policy</FieldLabel>
              <select value={form.negativeStockPolicy} onChange={(e) => setForm({ ...form, negativeStockPolicy: e.target.value })} className={selectClass}>
                <option value="block">Block sale</option>
                <option value="warn">Allow with warning</option>
                <option value="allow">Allow without warning</option>
              </select>
            </div>
          </FormSection>

          <FormSection title="Storage & expiry">
            <div><FieldLabel>Storage location</FieldLabel><input value={form.storageLocation} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} className={inputClass} placeholder="Store room, Refrigerator, Freezer…" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPerishable} onChange={(e) => setForm({ ...form, isPerishable: e.target.checked })} /> Perishable</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.trackBatch} onChange={(e) => setForm({ ...form, trackBatch: e.target.checked })} /> Batch tracking</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.trackExpiry} onChange={(e) => setForm({ ...form, trackExpiry: e.target.checked })} /> Expiry tracking</label>
          </FormSection>

          <FormSection title="Procurement">
            <div>
              <FieldLabel>Preferred supplier</FieldLabel>
              <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className={selectClass}>
                <option value="">None</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>HSN code</FieldLabel><input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} className={inputClass} /></div>
              <div><FieldLabel>Min order qty</FieldLabel><input type="number" step="0.01" value={form.minOrderQuantity} onChange={(e) => setForm({ ...form, minOrderQuantity: e.target.value })} className={inputClass} /></div>
            </div>
          </FormSection>

          <FormSection title="Advanced">
            <div><FieldLabel>Yield %</FieldLabel><input type="number" step="0.1" value={form.yieldPct} onChange={(e) => setForm({ ...form, yieldPct: e.target.value })} className={inputClass} /></div>
            <div><FieldLabel>Notes</FieldLabel><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClass} /></div>
          </FormSection>
        </form>
      </SlideOver>

      <SlideOver
        open={openingOpen}
        title={`Opening stock — ${editing?.name ?? ""}`}
        onClose={() => setOpeningOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpeningOpen(false)} className="px-4 py-2 rounded-xl border text-sm">Cancel</button>
            <button type="submit" form="opening-form" className="px-4 py-2 rounded-xl bg-kaana text-white text-sm font-medium">Record</button>
          </div>
        }
      >
        <form id="opening-form" onSubmit={saveOpeningStock} className="space-y-4">
          <p className="text-sm text-gray-600">Record initial stock quantity. Cost is optional for opening entries.</p>
          <div>
            <FieldLabel required>Quantity ({editing?.unit})</FieldLabel>
            <input required type="number" step="0.001" value={openingQty} onChange={(e) => setOpeningQty(e.target.value)} className={inputClass} />
          </div>
          <div>
            <FieldLabel>Unit cost (optional)</FieldLabel>
            <input type="number" step="0.01" value={openingCost} onChange={(e) => setOpeningCost(e.target.value)} className={inputClass} />
          </div>
        </form>
      </SlideOver>
    </PageContent>
  );
}

// Keep backward compat export
export { ItemsModule as MaterialsModule };
