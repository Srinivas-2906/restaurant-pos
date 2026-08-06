"use client";

import { useState } from "react";
import { Banknote, CreditCard, Smartphone, X } from "lucide-react";
import { formatInr, money, type Order } from "./types";

type PayMethod = "cash" | "card" | "upi";

const METHODS: Array<{ id: PayMethod; label: string; icon: typeof Banknote }> = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "upi", label: "UPI", icon: Smartphone },
];

interface PaymentModalProps {
  order: Order;
  onClose: () => void;
  onConfirm: (payments: Array<{ method: PayMethod; amount: number }>) => Promise<void>;
}

export function PaymentModal({ order, onClose, onConfirm }: PaymentModalProps) {
  const total = money(order.totalAmount);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [amount, setAmount] = useState(String(Math.ceil(total)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setQuickAmount(value: number) {
    setAmount(String(Math.max(total, value)));
  }

  async function handlePay() {
    setLoading(true);
    setError("");
    try {
      const paid = Number(amount);
      if (paid < total) {
        setError(`Amount must be at least ${formatInr(total)}`);
        return;
      }
      await onConfirm([{ method, amount: paid }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  const change = money(amount) - total;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Settle bill</h2>
            <p className="text-sm text-slate-500 mt-0.5">{order.orderNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="rounded-xl bg-slate-50 p-4 space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatInr(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Tax (GST)</span>
              <span>{formatInr(order.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-slate-900 pt-2 border-t border-slate-200">
              <span>Total due</span>
              <span className="text-kaana">{formatInr(total)}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payment method</p>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMethod(id)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    method === id
                      ? "border-kaana bg-orange-50 text-kaana"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount received</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-kaana/30 focus:border-kaana"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              <button type="button" onClick={() => setQuickAmount(total)} className="pos-chip">Exact</button>
              <button type="button" onClick={() => setQuickAmount(Math.ceil(total / 100) * 100)} className="pos-chip">Round ₹100</button>
              <button type="button" onClick={() => setQuickAmount(Math.ceil(total / 500) * 500)} className="pos-chip">Round ₹500</button>
            </div>
            {change > 0 && (
              <p className="text-sm font-medium text-emerald-600 mt-2">Change to return: {formatInr(change)}</p>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handlePay}
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50 shadow-sm"
          >
            {loading ? "Processing…" : "Complete payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
