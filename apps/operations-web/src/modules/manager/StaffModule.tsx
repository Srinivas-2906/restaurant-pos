"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getOutletId } from "@/lib/api";
import { StaffNav } from "./StaffNav";
import { AddEmployeeWizard, staffName } from "./AddEmployeeWizard";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";

interface StaffRow {
  id: string;
  employeeCode: string;
  displayName?: string | null;
  legalName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  employmentCategory?: string;
  hasLoginAccess?: boolean;
  wageType: string;
  monthlySalary?: number | string | null;
  hourlyRate?: number | string | null;
  pfAccount?: string | null;
  uan?: string | null;
  esicNumber?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  ifsc?: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string;
    roleAssignments?: Array<{ role: string }>;
  } | null;
  department?: { name: string } | null;
  designation?: { name: string } | null;
}

interface OnFloorRow {
  id: string;
  name?: string;
  role?: string | null;
  staff?: {
    id: string;
    displayName?: string | null;
    legalName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    user?: { firstName?: string; lastName?: string };
    designation?: { name: string };
  };
}

const emptyForm = {
  employeeCode: "",
  displayName: "",
  phone: "",
  gender: "",
  address: "",
  wageType: "monthly",
  monthlySalary: "",
  hourlyRate: "",
  pfAccount: "",
  uan: "",
  esicNumber: "",
  bankName: "",
  bankAccount: "",
  ifsc: "",
};

export function StaffModule() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [onFloor, setOnFloor] = useState<OnFloorRow[]>([]);
  const [open, setOpen] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [section, setSection] = useState<"basic" | "statutory" | "bank" | "salary">("basic");
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();

  function load() {
    if (!outletId) return;
    api<StaffRow[]>(`/staff/outlets/${outletId}`).then(setStaff).catch(() => setStaff([]));
    api<OnFloorRow[]>(`/staff/outlets/${outletId}/on-floor`).then(setOnFloor).catch(() => setOnFloor([]));
  }

  useEffect(load, [outletId]);

  function openCreate() {
    setEditing(null);
    setCreateMode(true);
    setOpen(true);
  }

  function openEdit(s: StaffRow) {
    setCreateMode(false);
    setEditing(s);
    setForm({
      employeeCode: s.employeeCode,
      displayName: s.displayName ?? "",
      phone: s.phone ?? "",
      gender: "",
      address: "",
      wageType: s.wageType,
      monthlySalary: s.monthlySalary ? String(s.monthlySalary) : "",
      hourlyRate: s.hourlyRate ? String(s.hourlyRate) : "",
      pfAccount: s.pfAccount ?? "",
      uan: s.uan ?? "",
      esicNumber: s.esicNumber ?? "",
      bankName: s.bankName ?? "",
      bankAccount: s.bankAccount ?? "",
      ifsc: s.ifsc ?? "",
    });
    setSection("basic");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId || !editing) return;
    try {
      await api(`/staff/profiles/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          employeeCode: form.employeeCode,
          displayName: form.displayName || undefined,
          phone: form.phone || undefined,
          gender: form.gender || undefined,
          address: form.address || undefined,
          currentAddress: form.address || undefined,
          wageType: form.wageType,
          monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : undefined,
          hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
          pfAccount: form.pfAccount || undefined,
          uan: form.uan || undefined,
          esicNumber: form.esicNumber || undefined,
          bankName: form.bankName || undefined,
          bankAccount: form.bankAccount || undefined,
          ifsc: form.ifsc || undefined,
        }),
      });
      setOpen(false);
      setMsg("Employee updated");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent className="space-y-6">
      <PageHeader
        title="Team"
        description="Employee roster — login access is optional and separate from employment records."
        action={
          <button type="button" onClick={openCreate} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
            Add employee
          </button>
        }
      />
      <StaffNav />
      {msg && <p className="text-sm text-green-700">{msg}</p>}

      <Panel title={`On floor now (${onFloor.length})`}>
        {onFloor.length === 0 ? (
          <EmptyState title="No one clocked in" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {onFloor.map((a) => (
              <li key={a.id} className="py-2 text-sm flex justify-between">
                <span>{a.name ?? (a.staff ? staffName(a.staff as StaffRow) : "—")}</span>
                <span className="text-gray-500 capitalize">
                  {(a.role ?? a.staff?.designation?.name ?? "—").replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Employees (${staff.length})`}>
        {staff.length === 0 ? (
          <EmptyState title="No employees yet" description="Add employees without creating a login account." />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-600">Employee</th>
                  <th className="text-left p-3 font-medium text-gray-600">Code</th>
                  <th className="text-left p-3 font-medium text-gray-600">Category</th>
                  <th className="text-left p-3 font-medium text-gray-600">Login</th>
                  <th className="text-left p-3 font-medium text-gray-600">Wage</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="p-3 font-medium">
                      <Link href={`/staff/${s.id}`} className="text-kaana hover:underline">{staffName(s)}</Link>
                    </td>
                    <td className="p-3">{s.employeeCode}</td>
                    <td className="p-3 capitalize">{(s.employmentCategory ?? "permanent").replace(/_/g, " ")}</td>
                    <td className="p-3">{s.hasLoginAccess || s.user ? "Yes" : "No"}</td>
                    <td className="p-3 capitalize">{s.wageType}</td>
                    <td className="p-3">
                      <button type="button" onClick={() => openEdit(s)} className="text-kaana text-sm font-medium hover:underline">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <SlideOver
        open={open}
        title={createMode ? "Add employee" : "Edit employee"}
        onClose={() => setOpen(false)}
        wide
        footer={
          createMode ? undefined : (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm">Close</button>
              <button type="submit" form="staff-form" className="px-4 py-2 rounded-xl bg-kaana text-white text-sm font-medium">Save details</button>
            </div>
          )
        }
      >
        {createMode ? (
          <AddEmployeeWizard
            employeeCodeSuggestion={`EMP-${String(staff.length + 1).padStart(3, "0")}`}
            onCancel={() => setOpen(false)}
            onComplete={() => {
              setOpen(false);
              setMsg("Employee created");
              load();
            }}
          />
        ) : (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              {(["basic", "statutory", "bank", "salary"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSection(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${section === s ? "bg-sidebar text-white" : "bg-gray-100 text-gray-600"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <form id="staff-form" onSubmit={save} className="space-y-4">
              {section === "basic" && (
                <>
                  <input required value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} placeholder="Employee code" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
                  <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Display name" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Mobile" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
                  <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
                </>
              )}
              {section === "statutory" && (
                <>
                  <input value={form.pfAccount} onChange={(e) => setForm({ ...form, pfAccount: e.target.value })} placeholder="PF account number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
                  <input value={form.uan} onChange={(e) => setForm({ ...form, uan: e.target.value })} placeholder="12-digit UAN" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
                  <input value={form.esicNumber} onChange={(e) => setForm({ ...form, esicNumber: e.target.value })} placeholder="10-digit ESIC IP number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
                </>
              )}
              {section === "bank" && (
                <>
                  <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="Bank name" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
                  <input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} placeholder="Account number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
                  <input value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} placeholder="IFSC code" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
                </>
              )}
              {section === "salary" && (
                <>
                  <select value={form.wageType} onChange={(e) => setForm({ ...form, wageType: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2.5">
                    <option value="monthly">Monthly salary</option>
                    <option value="hourly">Hourly wage</option>
                  </select>
                  {form.wageType === "monthly" ? (
                    <input type="number" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} placeholder="Monthly salary (₹)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
                  ) : (
                    <input type="number" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} placeholder="Hourly rate (₹)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5" />
                  )}
                </>
              )}
            </form>
          </>
        )}
      </SlideOver>
    </PageContent>
  );
}
