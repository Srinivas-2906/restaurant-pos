"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StaffNav } from "./StaffNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

interface Department {
  id: string;
  name: string;
  designations: Array<{ id: string; name: string }>;
  _count?: { staff: number };
}

export function MastersModule() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptName, setDeptName] = useState("");
  const [desigName, setDesigName] = useState("");
  const [deptId, setDeptId] = useState("");
  const [msg, setMsg] = useState("");

  function load() {
    api<Department[]>("/staff/departments").then(setDepartments).catch(() => setDepartments([]));
  }

  useEffect(load, []);

  async function addDepartment(e: React.FormEvent) {
    e.preventDefault();
    await api("/staff/departments", { method: "POST", body: JSON.stringify({ name: deptName }) });
    setDeptName("");
    setMsg("Department created");
    load();
  }

  async function addDesignation(e: React.FormEvent) {
    e.preventDefault();
    await api("/staff/designations", { method: "POST", body: JSON.stringify({ name: desigName, departmentId: deptId || undefined }) });
    setDesigName("");
    setMsg("Designation created");
    load();
  }

  return (
    <PageContent>
      <PageHeader title="Departments & designations" description="Organize staff by team and role." />
      <StaffNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Add department">
          <form onSubmit={addDepartment} className="flex gap-2">
            <input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="Department name" className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5" required />
            <button type="submit" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Add</button>
          </form>
        </Panel>
        <Panel title="Add designation">
          <form onSubmit={addDesignation} className="space-y-3">
            <input value={desigName} onChange={(e) => setDesigName(e.target.value)} placeholder="Designation name" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" required />
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5">
              <option value="">No department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="submit" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Add designation</button>
          </form>
        </Panel>
      </div>

      <Panel title="Organization structure">
        {departments.length === 0 ? (
          <EmptyState title="No departments" description="Create departments to organize your team." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {departments.map((d) => (
              <li key={d.id} className="py-4">
                <div className="flex justify-between mb-2">
                  <span className="font-semibold">{d.name}</span>
                  <span className="text-sm text-gray-500">{d._count?.staff ?? 0} staff</span>
                </div>
                {d.designations.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {d.designations.map((des) => (
                      <span key={des.id} className="px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-700">{des.name}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}
