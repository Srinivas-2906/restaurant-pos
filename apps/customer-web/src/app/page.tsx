"use client";

import { useState } from "react";
import { KaanaBrand, MenuItemGrid, formatCurrency } from "@kaana/ui";

const DEMO_MENU = [
  { id: "1", name: "Paneer Tikka", price: 249, isVeg: true },
  { id: "2", name: "Butter Chicken", price: 349, isVeg: false },
  { id: "3", name: "Butter Naan", price: 59, isVeg: true },
];

export default function MenuPage() {
  const [cart, setCart] = useState<Array<{ id: string; name: string; price: number; qty: number }>>([]);
  const [step, setStep] = useState<"menu" | "pay" | "status">("menu");

  function addItem(id: string) {
    const item = DEMO_MENU.find((m) => m.id === id);
    if (!item) return;
    setCart((c) => {
      const existing = c.find((x) => x.id === id);
      if (existing) return c.map((x) => (x.id === id ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { ...item, qty: 1 }];
    });
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  if (step === "status") {
    return (
      <main className="mx-auto max-w-md min-h-dvh px-4 pb-24 pt-6 safe-top safe-bottom">
        <KaanaBrand size="sm" framed appLabel="Order at Table" className="mb-6" labelClassName="text-gray-500" />
        <h1 className="text-xl font-bold text-gray-900">Order status — Q3</h1>
        <p className="mt-2 text-emerald-600 font-semibold">Preparing your order…</p>
        <button
          type="button"
          onClick={() => setStep("menu")}
          className="mt-8 text-sm font-medium text-kaana hover:text-kaana-dark"
        >
          Order again
        </button>
      </main>
    );
  }

  if (step === "pay") {
    return (
      <main className="mx-auto max-w-md min-h-dvh px-4 pb-24 pt-6 safe-top safe-bottom">
        <KaanaBrand size="sm" framed appLabel="Order at Table" className="mb-6" labelClassName="text-gray-500" />
        <h1 className="text-xl font-bold text-gray-900">Pay — Q2</h1>
        <p className="mt-4 text-3xl font-bold text-gray-900">{formatCurrency(total)}</p>
        <button
          type="button"
          onClick={() => setStep("status")}
          className="mt-8 w-full rounded-xl bg-gray-900 py-4 font-semibold text-white hover:bg-gray-800 transition-colors"
        >
          Pay via UPI
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md min-h-dvh px-4 pb-28 pt-6 safe-top safe-bottom">
      <KaanaBrand size="sm" framed appLabel="Order at Table" className="mb-2" labelClassName="text-gray-500" />
      <p className="text-sm text-gray-500 mb-5">Table T5 · Scan to order</p>
      <MenuItemGrid items={DEMO_MENU} onSelect={addItem} />
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-4 safe-bottom shadow-panel">
          <button
            type="button"
            onClick={() => setStep("pay")}
            className="w-full rounded-xl bg-gray-900 py-4 font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            View cart ({cart.length}) — {formatCurrency(total)}
          </button>
        </div>
      )}
    </main>
  );
}
