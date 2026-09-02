"use client";

import { useState } from "react";
import { MenuItemGrid, formatCurrency } from "@kaana/ui";

const DEMO_MENU = [
  { id: "1", name: "Paneer Tikka", price: 249, isVeg: true },
  { id: "2", name: "Butter Chicken", price: 349, isVeg: false },
  { id: "3", name: "Butter Naan", price: 59, isVeg: true },
];

function BrandMark({ label }: { label?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "inline-flex", background: "#000", borderRadius: 12, padding: "8px 14px" }}>
        <img src="/kaana-logo.png" alt="Kaana Kitchens" style={{ height: 40, width: "auto", maxWidth: "100%", objectFit: "contain" }} />
      </div>
      {label && (
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", margin: "8px 0 0" }}>
          {label}
        </p>
      )}
    </div>
  );
}

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

  const shellStyle: React.CSSProperties = {
    maxWidth: 480,
    margin: "0 auto",
    padding: "16px 16px 96px",
    minHeight: "100dvh",
    overflowX: "clip",
    width: "100%",
    boxSizing: "border-box",
  };

  if (step === "status") {
    return (
      <main style={shellStyle}>
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Order Status — Q3</h1>
        <p style={{ color: "#22c55e", fontWeight: "bold" }}>Preparing your order...</p>
        <button onClick={() => setStep("menu")} style={{ marginTop: 24 }}>Order again</button>
      </main>
    );
  }

  if (step === "pay") {
    return (
      <main style={shellStyle}>
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Pay — Q2</h1>
        <p style={{ fontSize: 24, fontWeight: "bold" }}>{formatCurrency(total)}</p>
        <button
          onClick={() => setStep("status")}
          style={{ width: "100%", padding: 16, background: "#111", color: "#fff", border: "none", borderRadius: 12, marginTop: 16 }}
        >
          Pay via UPI
        </button>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <BrandMark label="Order at Table" />
      <p style={{ color: "#666", margin: "0 0 16px" }}>Table T5 · Scan to order</p>
      <script src="https://cdn.tailwindcss.com"></script>
      <div style={{ minWidth: 0 }}>
        <MenuItemGrid items={DEMO_MENU} onSelect={addItem} />
      </div>
      {cart.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#fff",
            padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
            borderTop: "1px solid #eee",
            boxSizing: "border-box",
          }}
        >
          <button
            onClick={() => setStep("pay")}
            style={{ width: "100%", padding: 16, background: "#111", color: "#fff", border: "none", borderRadius: 12 }}
          >
            View Cart ({cart.length}) — {formatCurrency(total)}
          </button>
        </div>
      )}
    </main>
  );
}
