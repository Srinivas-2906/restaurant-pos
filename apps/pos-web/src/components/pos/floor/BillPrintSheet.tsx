"use client";

import { useEffect, useRef } from "react";
import { formatInr, money } from "./types";

export interface ProformaBill {
  type: "proforma";
  orderNumber: string;
  tableNumber: string | null;
  guestCount: number;
  printedAt: string;
  isReprint: boolean;
  outlet: {
    name: string;
    address?: string | null;
    city?: string | null;
    gstin?: string | null;
  };
  items: Array<{ name: string; quantity: number; unitPrice: number; totalPrice: number }>;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  disclaimer: string;
}

interface BillPrintSheetProps {
  bill: ProformaBill | null;
  onPrinted: () => void;
}

export function BillPrintSheet({ bill, onPrinted }: BillPrintSheetProps) {
  const printedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!bill || printedRef.current === bill.printedAt + bill.orderNumber) return;
    printedRef.current = bill.printedAt + bill.orderNumber;
    const timer = setTimeout(() => {
      window.print();
      onPrinted();
    }, 150);
    return () => clearTimeout(timer);
  }, [bill, onPrinted]);

  if (!bill) return null;

  return (
    <div className="bill-print-root fixed left-0 top-0 -z-50 opacity-0 print:opacity-100 print:z-[9999] print:relative">
      <div className="bill-print-sheet w-[80mm] max-w-[80mm] mx-auto bg-white text-black p-4 text-[11px] leading-snug font-mono">
        <div className="text-center border-b border-dashed border-black pb-2 mb-2">
          <p className="text-sm font-bold uppercase">{bill.outlet.name}</p>
          {bill.outlet.address && <p>{bill.outlet.address}</p>}
          {bill.outlet.city && <p>{bill.outlet.city}</p>}
          {bill.outlet.gstin && <p className="mt-1">GSTIN: {bill.outlet.gstin}</p>}
        </div>

        <p className="text-center font-bold text-xs mb-2">
          {bill.isReprint ? "DUPLICATE BILL" : "PROFORMA BILL"}
        </p>

        <div className="space-y-0.5 mb-2">
          <p>Order: {bill.orderNumber}</p>
          {bill.tableNumber && <p>Table: {bill.tableNumber}</p>}
          <p>Guests: {bill.guestCount}</p>
          <p>{new Date(bill.printedAt).toLocaleString("en-IN")}</p>
        </div>

        <div className="border-t border-dashed border-black pt-2 mb-2">
          {bill.items.map((item, idx) => (
            <div key={idx} className="flex justify-between gap-2 mb-1">
              <span className="flex-1">
                {item.quantity}× {item.name}
              </span>
              <span className="shrink-0">{formatInr(item.totalPrice)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-black pt-2 space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatInr(bill.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax (GST)</span>
            <span>{formatInr(bill.taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm pt-1">
            <span>TOTAL</span>
            <span>{formatInr(bill.totalAmount)}</span>
          </div>
        </div>

        <p className="text-center text-[9px] mt-3 pt-2 border-t border-dashed border-black">
          {bill.disclaimer}
        </p>
        <p className="text-center mt-2">Thank you for dining with us!</p>
      </div>
    </div>
  );
}

export function BillPreviewCard({ bill }: { bill: ProformaBill }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 max-h-[50vh] overflow-y-auto">
      <p className="font-semibold text-slate-900">{bill.outlet.name}</p>
      <p className="text-xs text-slate-500 mt-1">{bill.orderNumber} · Table {bill.tableNumber ?? "—"}</p>
      <div className="mt-3 space-y-1.5">
        {bill.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span>{item.quantity}× {item.name}</span>
            <span>{formatInr(item.totalPrice)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between font-bold">
        <span>Total</span>
        <span className="text-kaana">{formatInr(money(bill.totalAmount))}</span>
      </div>
    </div>
  );
}
