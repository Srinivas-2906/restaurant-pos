"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";
import { formatCurrency } from "@kaana/ui";

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  consumptionUnit?: string | null;
  currentStock: number | string;
  minStock: number | string;
  parStock: number | string;
  costPerUnit: number | string;
  isActive: boolean;
  isFavourite: boolean;
  supplier?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

const emptyForm = {
  name: "",
  unit: "kg",
  consumptionUnit: "",
  minStock: "0",
  parStock: "0",
  costPerUnit: "0",
  categoryId: "",
  supplierId: "",
  taxPct: "0",
  normalLossPct: "0",
  allowDecimal: true,
  isFavourite: false,
};

export function MaterialsModule() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<Ingredient[]>(`/inventory/outlets/${outletId}/ingredients`).then(setItems).catch(() => setItems([]));
    api<Category[]>(`/inventory/outlets/${outletId}/categories`).then(setCategories).catch(() => setCategories([]));
    api<Supplier[]>(`/inventory/outlets/${outletId}/suppliers`).then(setSuppliers).catch(() => setSuppliers([]));
  }

  useEffect(load, [outletId]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(item: Ingredient) {
    setEditing(item);
    setForm({
      name: item.name,
      unit: item.unit,
      consumptionUnit: item.consumptionUnit ?? "",
      minStock: String(item.minStock),
      parStock: String(item.parStock ?? item.minStock),
      costPerUnit: String(item.costPerUnit),
      categoryId: item.category?.id ?? "",
      supplierId: item.supplier?.id ?? "",
      taxPct: "0",
      normalLossPct: "0",
      allowDecimal: true,
      isFavourite: item.isFavourite,
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    const payload = {
      ...form,
      minStock: Number(form.minStock),
      parStock: Number(form.parStock),
      costPerUnit: Number(form.costPerUnit),
      taxPct: Number(form.taxPct),
      normalLossPct: Number(form.normalLossPct),
      categoryId: form.categoryId || undefined,
      supplierId: form.supplierId || undefined,
      consumptionUnit: form.consumptionUnit || undefined,
    };
    try {
      if (editing) {
        await api(`/inventory/ingredients/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api(`/inventory/outlets/${outletId}/ingredients`, { method: "POST", body: JSON.stringify(payload) });
      }
      setOpen(false);
      setMsg(editing ? "Material updated" : "Material created");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader
        title="Raw Materials"
        description="Manage ingredients, units, and stock thresholds."
        action={
          <button type="button" onClick={openCreate} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
            Add material
          </button>
        }
      />
      <InventoryNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title={`Materials (${items.length})`}>
        {items.length === 0 ? (
          <EmptyState title="No materials" description="Add your first raw material to track stock." />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Name</th>
                  <th className="text-left p-3 font-medium text-gray-600">Category</th>
                  <th className="text-left p-3 font-medium text-gray-600">Stock</th>
                  <th className="text-left p-3 font-medium text-gray-600">Min / Par</th>
                  <th className="text-left p-3 font-medium text-gray-600">Cost</th>
                  <th className="text-left p-3 font-medium text-gray-600">Supplier</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-gray-100">
                    <td className="p-3 font-medium">{i.isFavourite ? "★ " : ""}{i.name}</td>
                    <td className="p-3">{i.category?.name ?? "—"}</td>
                    <td className="p-3">{i.currentStock} {i.unit}</td>
                    <td className="p-3">{i.minStock} / {i.parStock ?? i.minStock}</td>
                    <td className="p-3">{formatCurrency(Number(i.costPerUnit))}</td>
                    <td className="p-3">{i.supplier?.name ?? "—"}</td>
                    <td className="p-3">
                      <button type="button" onClick={() => openEdit(i)} className="text-kaana text-sm font-medium hover:underline">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <SlideOver
        open={open}
        title={editing ? "Edit material" : "Add material"}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">
              Cancel
            </button>
            <button type="submit" form="material-form" className="px-4 py-2 rounded-xl bg-kaana text-white text-sm font-medium">
              Save
            </button>
          </div>
        }
      >
        <form id="material-form" onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5">
                {["kg", "ltr", "piece", "gm", "ml", "box"].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Consumption unit</label>
              <input value={form.consumptionUnit} onChange={(e) => setForm({ ...form, consumptionUnit: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" placeholder="Same as unit" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5">
              <option value="">Uncategorized</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5">
              <option value="">None</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min stock</label>
              <input type="number" step="0.01" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Par stock</label>
              <input type="number" step="0.01" value={form.parStock} onChange={(e) => setForm({ ...form, parStock: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost/unit</label>
              <input type="number" step="0.01" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isFavourite} onChange={(e) => setForm({ ...form, isFavourite: e.target.checked })} />
            Mark as favourite
          </label>
        </form>
      </SlideOver>
    </PageContent>
  );
}
