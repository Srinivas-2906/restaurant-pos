"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PlatformNav } from "@/components/PlatformNav";

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!localStorage.getItem("token")) { router.push("/"); return; }
    api<Array<Record<string, unknown>>>("/users").then(setUsers).catch(console.error);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PlatformNav />
      <main className="p-6 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">User Management</h2>
        <table className="w-full bg-white border rounded-xl overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-gray-600">Name</th>
              <th className="text-left p-4 text-sm font-medium text-gray-600">Email</th>
              <th className="text-left p-4 text-sm font-medium text-gray-600">Role</th>
              <th className="text-left p-4 text-sm font-medium text-gray-600">Outlet</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id as string} className="border-t">
                <td className="p-4">{u.firstName as string} {u.lastName as string}</td>
                <td className="p-4 text-gray-600">{u.email as string}</td>
                <td className="p-4">
                  <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs">
                    {(u.roleAssignments as Array<{ role: string }>)?.[0]?.role ?? "—"}
                  </span>
                </td>
                <td className="p-4 text-gray-500">
                  {(u.roleAssignments as Array<{ outlet?: { name: string } }>)?.[0]?.outlet?.name ?? "All"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
