"use client";

import { PlatformNav } from "@/components/PlatformNav";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PlatformNav />
      <main className="p-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Platform Support</h2>
        <p className="text-gray-500">Support tickets, integration health, and staff impersonation with audit logging coming soon.</p>
      </main>
    </div>
  );
}
