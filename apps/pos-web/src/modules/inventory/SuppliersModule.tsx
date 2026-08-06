"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { InventoryNav } from "./InventoryNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";

interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  address?: string | null;
  isActive: boolean;
}

const emptyForm = { name: "", phone: "", email: "", gstin: "", address: "" };

export function SuppliersModule() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<Supplier[]>(`/inventory/outlets/${outletId}/suppliers`).then(setSuppliers).catch(() => setSuppliers([]));
  }

  useEffect(load, [outletId]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone ?? "",
      email: s.email ?? "",
      gstin: s.gstin ?? "",
      address: s.address ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    try {
      if (editing) {
        await api(`/inventory/suppliers/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await api(`/inventory/outlets/${outletId}/suppliers`, { method: "POST", body: JSON.stringify(form) });
      }
      setOpen(false);
      setMsg(editing ? "Supplier updated" : "Supplier created");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader
        title="Suppliers"
        description="Vendor contacts and GST details."
        action={
          <button type="button" onClick={openCreate} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
            Add supplier
          </button>
        }
      />
      <InventoryNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title={`Suppliers (${suppliers.length})`}>
        {suppliers.length === 0 ? (
          <EmptyState title="No suppliers" description="Add vendors for purchase orders." />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Name</th>
                  <th className="text-left p-3 font-medium text-gray-600">Phone</th>
                  <th className="text-left p-3 font-medium text-gray-600">Email</th>
                  <th className="text-left p-3 font-medium text-gray-600">GSTIN</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">{s.phone ?? "—"}</td>
                    <td className="p-3">{s.email ?? "—"}</td>
                    <td className="p-3">{s.gstin ?? "—"}</td>
                    <td className="p-3">
                      <button type="button" onClick={() => openEdit(s)} className="text-kaana text-sm font-medium hover:underline">Edit</button>
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
        title={editing ? "Edit supplier" : "Add supplier"}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">Cancel</button>
            <button type="submit" form="supplier-form" className="px-4 py-2 rounded-xl bg-kaana text-white text-sm font-medium">Save</button>
          </div>
        }
      >
        <form id="supplier-form" onSubmit={save} className="space-y-4">
          <input required placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
          <input placeholder="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
          <textarea placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
        </form>
      </SlideOver>
    </PageContent>
  );
}
