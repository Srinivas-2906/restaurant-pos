"use client";

import { useEffect, useState } from "react";
import { api, getOutletId } from "@/lib/api";
import { PurchasesNav } from "./PurchasesNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";
import { FormSection, FieldLabel, inputClass } from "@/components/inventory/FormSection";
import { formatCurrency } from "@kaana/ui";

interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  gstin?: string | null;
  pan?: string | null;
  fssaiLicense?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  paymentTerms?: string | null;
  creditDays?: number;
  creditLimit?: number | string;
  minOrderValue?: number | string;
  deliveryLeadTime?: number;
  onTimeDeliveryPct?: number | string;
  rejectionRate?: number | string;
  outstandingAmount?: number | string;
  totalPurchases?: number | string;
  isActive: boolean;
}

const emptyForm = {
  name: "", contactPerson: "", phone: "", whatsapp: "", email: "", address: "",
  gstin: "", pan: "", fssaiLicense: "", paymentTerms: "", creditDays: "0",
  creditLimit: "0", minOrderValue: "0", deliveryLeadTime: "0",
};

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
      contactPerson: s.contactPerson ?? "",
      phone: s.phone ?? "",
      whatsapp: s.whatsapp ?? "",
      email: s.email ?? "",
      gstin: s.gstin ?? "",
      pan: s.pan ?? "",
      fssaiLicense: s.fssaiLicense ?? "",
      address: s.address ?? "",
      paymentTerms: s.paymentTerms ?? "",
      creditDays: String(s.creditDays ?? 0),
      creditLimit: String(s.creditLimit ?? 0),
      minOrderValue: String(s.minOrderValue ?? 0),
      deliveryLeadTime: String(s.deliveryLeadTime ?? 0),
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    const payload = {
      ...form,
      creditDays: Number(form.creditDays),
      creditLimit: Number(form.creditLimit),
      minOrderValue: Number(form.minOrderValue),
      deliveryLeadTime: Number(form.deliveryLeadTime),
    };
    try {
      if (editing) {
        await api(`/inventory/suppliers/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api(`/inventory/outlets/${outletId}/suppliers`, { method: "POST", body: JSON.stringify(payload) });
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
        description="Vendor master with commercial terms and performance tracking."
        action={
          <button type="button" onClick={openCreate} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
            Add supplier
          </button>
        }
      />
      <PurchasesNav />
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
                  <th className="text-left p-3 font-medium text-gray-600">Contact</th>
                  <th className="text-left p-3 font-medium text-gray-600">GSTIN</th>
                  <th className="text-left p-3 font-medium text-gray-600">Lead time</th>
                  <th className="text-left p-3 font-medium text-gray-600">On-time %</th>
                  <th className="text-left p-3 font-medium text-gray-600">Outstanding</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">{s.phone ?? s.email ?? "—"}</td>
                    <td className="p-3">{s.gstin ?? "—"}</td>
                    <td className="p-3">{s.deliveryLeadTime ?? 0} days</td>
                    <td className="p-3">{Number(s.onTimeDeliveryPct ?? 0).toFixed(0)}%</td>
                    <td className="p-3">{formatCurrency(Number(s.outstandingAmount ?? 0))}</td>
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
        wide
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border text-sm">Cancel</button>
            <button type="submit" form="supplier-form" className="px-4 py-2 rounded-xl bg-kaana text-white text-sm font-medium">Save</button>
          </div>
        }
      >
        <form id="supplier-form" onSubmit={save} className="space-y-4">
          <FormSection title="Identity" defaultOpen>
            <input required placeholder="Supplier name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            <input placeholder="Contact person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
              <input placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className={inputClass} />
            </div>
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
            <textarea placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className={inputClass} />
              <input placeholder="PAN" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} className={inputClass} />
            </div>
            <input placeholder="FSSAI licence" value={form.fssaiLicense} onChange={(e) => setForm({ ...form, fssaiLicense: e.target.value })} className={inputClass} />
          </FormSection>
          <FormSection title="Commercial terms">
            <input placeholder="Payment terms" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <div><FieldLabel>Credit days</FieldLabel><input type="number" value={form.creditDays} onChange={(e) => setForm({ ...form, creditDays: e.target.value })} className={inputClass} /></div>
              <div><FieldLabel>Credit limit</FieldLabel><input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} className={inputClass} /></div>
              <div><FieldLabel>Min order value</FieldLabel><input type="number" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} className={inputClass} /></div>
              <div><FieldLabel>Delivery lead time (days)</FieldLabel><input type="number" value={form.deliveryLeadTime} onChange={(e) => setForm({ ...form, deliveryLeadTime: e.target.value })} className={inputClass} /></div>
            </div>
          </FormSection>
        </form>
      </SlideOver>
    </PageContent>
  );
}
