"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { notify } from "@kaana/ui";
import { api } from "@/lib/api";
import type { FloorTable } from "@/modules/reservations/types";

const SOURCES = ["walk_in", "phone", "website", "whatsapp"] as const;

export function ReservationDrawer({
  outletId,
  tables,
  onClose,
  onSaved,
}: {
  outletId: string;
  tables?: FloorTable[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    guestName: "",
    guestPhone: "",
    guestCount: 2,
    date: "",
    time: "19:00",
    source: "walk_in" as (typeof SOURCES)[number],
    occasion: "",
    specialRequest: "",
    preferredArea: "",
    advancePayment: "",
    tableId: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const dateTime = new Date(`${form.date}T${form.time}:00`).toISOString();
      await api("/reservations", {
        method: "POST",
        body: JSON.stringify({
          outletId,
          guestName: form.guestName,
          guestPhone: form.guestPhone,
          guestCount: Number(form.guestCount),
          date: dateTime,
          source: form.source,
          occasion: form.occasion || undefined,
          specialRequest: form.specialRequest || undefined,
          preferredArea: form.preferredArea || undefined,
          advancePayment: form.advancePayment ? Number(form.advancePayment) : undefined,
          tableId: form.tableId || undefined,
        }),
      });
      notify.success("Reservation created");
      onSaved();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-md bg-white h-full shadow-panel overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-lg">New booking</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-600">Guest name</span>
            <input required value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Phone</span>
            <input required minLength={10} value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-600">Date</span>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Time</span>
              <input required type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-600">Guests</span>
            <input required type="number" min={1} value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })} className="mt-1 w-full border rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Source</span>
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as typeof form.source })} className="mt-1 w-full border rounded-lg px-3 py-2">
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Occasion</span>
            <input value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Birthday, anniversary…" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Special request</span>
            <textarea value={form.specialRequest} onChange={(e) => setForm({ ...form, specialRequest: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" rows={2} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Preferred area</span>
            <input value={form.preferredArea} onChange={(e) => setForm({ ...form, preferredArea: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Advance payment (₹)</span>
            <input type="number" min={0} value={form.advancePayment} onChange={(e) => setForm({ ...form, advancePayment: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2" />
          </label>
          {tables && tables.length > 0 && (
            <label className="block text-sm">
              <span className="text-slate-600">Pre-assign table (optional)</span>
              <select value={form.tableId} onChange={(e) => setForm({ ...form, tableId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2">
                <option value="">None</option>
                {tables.filter((t) => t.status === "free").map((t) => (
                  <option key={t.id} value={t.id}>Table {t.number} ({t.capacity} seats)</option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" disabled={busy} className="w-full py-2.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-500 disabled:opacity-50 flex items-center justify-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Create reservation
          </button>
        </form>
      </div>
    </div>
  );
}
