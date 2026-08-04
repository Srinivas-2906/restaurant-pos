"use client";

import { useState } from "react";
import { MenuItemGrid, formatCurrency } from "@kaana/ui";

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
      if (existing) return c.map((x) => x.id === id ? { ...x, qty: x.qty + 1 } : x);
      return [...c, { ...item, qty: 1 }];
    });
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  if (step === "status") {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
        <h1>Order Status — Q3</h1>
        <p style={{ color: "#22c55e", fontWeight: "bold" }}>Preparing your order...</p>
        <button onClick={() => setStep("menu")} style={{ marginTop: 24 }}>Order again</button>
      </main>
    );
  }

  if (step === "pay") {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
        <h1>Pay — Q2</h1>
        <p style={{ fontSize: 24, fontWeight: "bold" }}>{formatCurrency(total)}</p>
        <button onClick={() => setStep("status")} style={{ width: "100%", padding: 16, background: "#ea580c", color: "#fff", border: "none", borderRadius: 8, marginTop: 16 }}>
          Pay via UPI
        </button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16 }}>
      <h1 style={{ color: "#ea580c" }}>Kaana Foods</h1>
      <p style={{ color: "#666" }}>Table T5 · Scan to order</p>
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="mt-4">
        <MenuItemGrid items={DEMO_MENU} onSelect={addItem} />
      </div>
      {cart.length > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", padding: 16, borderTop: "1px solid #eee" }}>
          <button onClick={() => setStep("pay")} style={{ width: "100%", padding: 16, background: "#ea580c", color: "#fff", border: "none", borderRadius: 8 }}>
            View Cart ({cart.length}) — {formatCurrency(total)}
          </button>
        </div>
      )}
    </main>
  );
}
