"use client";

import Link from "next/link";

const CHECKLIST = [
  { title: "Menu", description: "Categories, items, prices, and kitchen stations", href: "/menu" },
  { title: "Taxes", description: "GST rules and invoice settings", href: "/settings" },
  { title: "Tables", description: "Floor plan and table layout", href: "/outlets" },
  { title: "Employees", description: "Staff profiles, roles, and PIN access", href: "/staff" },
  { title: "POS devices", description: "Register counter terminals", href: "/devices" },
  { title: "KDS devices", description: "Kitchen display registration", href: "/devices" },
  { title: "Printers", description: "Receipt and KOT printer setup", href: "/devices" },
  { title: "Inventory", description: "Materials, recipes, and suppliers", href: "/inventory" },
  { title: "Integrations", description: "Aggregators and payment providers", href: "/settings" },
];

export default function SetupChecklistPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Restaurant setup</h1>
        <p className="text-slate-600 mt-2">
          Your account is ready. Use this checklist to configure the outlet before going live.
          Kaana support can help during early setup.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CHECKLIST.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="block rounded-xl border border-slate-200 bg-white p-4 shadow-card hover:border-slate-300 transition-colors"
          >
            <h2 className="font-semibold text-slate-900">{item.title}</h2>
            <p className="text-sm text-slate-600 mt-1">{item.description}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        Operational staff (cashiers, captains, kitchen) do not need SaaS onboarding. After you
        configure employees and devices, they sign in with employee selection + PIN on the registered
        device.
      </div>
    </div>
  );
}
