"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KaanaBrand } from "@kaana/ui";
import Link from "next/link";
import { api, getUser, logout } from "@/lib/api";

export default function ReportsPage() {
  const router = useRouter();
  const user = getUser();
  const [outletId, setOutletId] = useState("");
  const [sales, setSales] = useState<Record<string, unknown> | null>(null);
  const [gst, setGst] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/"); return; }
    const outlets = user?.organization?.brands?.[0]?.outlets;
    if (outlets?.[0]?.id) setOutletId(outlets[0].id);
  }, [router, user]);

  useEffect(() => {
    if (!outletId) return;
    const from = new Date(); from.setDate(1);
    const to = new Date();
    const params = `outletId=${outletId}&from=${from.toISOString()}&to=${to.toISOString()}`;
    api<Record<string, unknown>>(`/reports/sales?${params}`).then(setSales).catch(console.error);
    api<Record<string, unknown>>(`/reports/gst/export?${params}`).then(setGst).catch(console.error);
  }, [outletId]);

  return (
    <div className="min-h-screen">
      <nav className="bg-white border-b px-4 sm:px-6 py-3 flex flex-wrap justify-between gap-3 overflow-x-clip">
        <div className="flex gap-4 sm:gap-6 items-center min-w-0 flex-wrap">
          <Link href="/dashboard" className="shrink-0">
            <KaanaBrand size="xs" framed appLabel="HQ" labelClassName="text-gray-500" />
          </Link>
          <Link href="/reports">Reports</Link>
        </div>
        <button onClick={() => { logout(); router.push("/"); }} className="text-red-600 text-sm">Logout</button>
      </nav>
      <main className="p-6 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Reports & GST</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-xl p-6">
            <h3 className="font-semibold mb-4">Sales Report (MTD)</h3>
            {sales ? (
              <div className="space-y-2">
                <p>Total Revenue: <strong>₹{Number(sales.totalRevenue).toLocaleString("en-IN")}</strong></p>
                <p>Total Orders: <strong>{sales.totalOrders as number}</strong></p>
                <p>Avg Order Value: <strong>₹{Number(sales.avgOrderValue).toFixed(0)}</strong></p>
              </div>
            ) : <p className="text-gray-400">Loading...</p>}
          </div>
          <div className="bg-white border rounded-xl p-6">
            <h3 className="font-semibold mb-4">GST Export (MTD)</h3>
            {gst ? (
              <div className="space-y-2">
                <p>Invoices: <strong>{gst.totalInvoices as number}</strong></p>
                <p>Taxable Amount: <strong>₹{Number(gst.totalTaxable).toLocaleString("en-IN")}</strong></p>
                <p>CGST: <strong>₹{Number(gst.totalCGST).toLocaleString("en-IN")}</strong></p>
                <p>SGST: <strong>₹{Number(gst.totalSGST).toLocaleString("en-IN")}</strong></p>
              </div>
            ) : <p className="text-gray-400">Loading...</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
