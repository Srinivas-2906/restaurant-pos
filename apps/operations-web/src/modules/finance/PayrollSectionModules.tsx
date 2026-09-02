"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getOutletId } from "@/lib/api";
import { PayrollNav } from "./PayrollNav";
import { PageContent } from "@/components/shell/PageContent";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";
import { MetricCard } from "@/components/ui/MetricCard";

export { PayrollModule, PayrollRunDetailModule, PayslipModule } from "./PayrollModules";

const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm";

function formatStaffName(s: StaffRow) {
  if (s.displayName?.trim()) return s.displayName.trim();
  if (s.legalName?.trim()) return s.legalName.trim();
  if (s.firstName?.trim()) return `${s.firstName} ${s.lastName ?? ""}`.trim();
  if (s.user) return `${s.user.firstName} ${s.user.lastName ?? ""}`.trim();
  return s.employeeCode ?? s.id.slice(0, 8);
}

interface StaffRow {
  id: string;
  employeeCode?: string;
  displayName?: string | null;
  legalName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  wageType?: string;
  user?: { firstName: string; lastName: string | null } | null;
}

function useOutletStaff() {
  const outletId = getOutletId();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  useEffect(() => {
    if (!outletId) return;
    api<StaffRow[]>(`/staff/outlets/${outletId}`).then(setStaff).catch(() => setStaff([]));
  }, [outletId]);
  return { outletId, staff };
}

interface PayrollOverview {
  currentRunStatus: string;
  wagePaymentDueDate: string;
  pendingApprovals: number;
  allowedTransitions: string[];
  recentRuns: Array<{ id: string; status: string; periodStart: string; periodEnd: string }>;
}

export function PayrollOverviewModule() {
  const outletId = getOutletId();
  const [data, setData] = useState<PayrollOverview | null>(null);

  useEffect(() => {
    const q = outletId ? `?outletId=${outletId}` : "";
    api<PayrollOverview>(`/hr/payroll-overview${q}`).then(setData).catch(() => setData(null));
  }, [outletId]);

  return (
    <PageContent className="space-y-6">
      <PageHeader title="Payroll Overview" description="Wage periods, compliance deadlines and payroll readiness." />
      <PayrollNav />
      <div className="grid md:grid-cols-3 gap-4">
        <Panel>
          <p className="text-sm text-gray-500">Wage payment due</p>
          <p className="font-semibold mt-1">{data?.wagePaymentDueDate ? new Date(data.wagePaymentDueDate).toLocaleDateString() : "—"}</p>
        </Panel>
        <Panel>
          <p className="text-sm text-gray-500">Current run status</p>
          <p className="font-semibold mt-1 capitalize">{data?.currentRunStatus?.replace("_", " ") ?? "—"}</p>
          <Link href="/payroll/runs" className="text-sm text-kaana font-medium hover:underline mt-2 inline-block">View payroll runs →</Link>
        </Panel>
        <Panel>
          <p className="text-sm text-gray-500">Pending approvals</p>
          <p className="font-semibold mt-1">{data?.pendingApprovals ?? 0}</p>
        </Panel>
      </div>
      <Panel title="Recent payroll runs">
        {(data?.recentRuns.length ?? 0) === 0 ? (
          <EmptyState title="No payroll runs yet" />
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {data?.recentRuns.map((r) => (
              <li key={r.id} className="py-3 flex justify-between">
                <span>{new Date(r.periodStart).toLocaleDateString()} – {new Date(r.periodEnd).toLocaleDateString()}</span>
                <span className="capitalize text-gray-500">{r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageContent>
  );
}

interface SalaryComponent {
  id: string;
  code: string;
  name: string;
  kind: string;
}

interface SalaryStructure {
  id: string;
  name: string;
  code: string;
}

export function SalaryStructuresModule() {
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [openComp, setOpenComp] = useState(false);
  const [openStruct, setOpenStruct] = useState(false);
  const [msg, setMsg] = useState("");
  const [compForm, setCompForm] = useState({ code: "", name: "", kind: "earning" });
  const [structForm, setStructForm] = useState({ code: "", name: "" });

  function load() {
    api<SalaryComponent[]>("/hr/salary-components").then(setComponents).catch(() => setComponents([]));
    api<SalaryStructure[]>("/hr/salary-structures").then(setStructures).catch(() => setStructures([]));
  }

  useEffect(load, []);

  async function saveComponent(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/hr/salary-components", { method: "POST", body: JSON.stringify(compForm) });
      setOpenComp(false);
      setMsg("Component created");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function saveStructure(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/hr/salary-structures", { method: "POST", body: JSON.stringify(structForm) });
      setOpenStruct(false);
      setMsg("Structure created");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader
        title="Salary Structures"
        description="Versioned salary components with effective dates."
        action={
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpenStruct(true)} className="border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium">Add structure</button>
            <button type="button" onClick={() => setOpenComp(true)} className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Add component</button>
          </div>
        }
      />
      <PayrollNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Salary components">
          {components.length === 0 ? <EmptyState title="No components" /> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {components.map((c) => (
                <li key={c.id} className="py-3 flex justify-between">
                  <span>{c.name} <span className="text-gray-400">({c.code})</span></span>
                  <span className="capitalize text-gray-500">{c.kind}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Salary structures">
          {structures.length === 0 ? <EmptyState title="No structures" /> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {structures.map((s) => (
                <li key={s.id} className="py-3 flex justify-between">
                  <span>{s.name}</span>
                  <span className="text-gray-400">{s.code}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <SlideOver open={openComp} title="Add salary component" onClose={() => setOpenComp(false)} footer={
        <button type="submit" form="comp-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Save</button>
      }>
        <form id="comp-form" onSubmit={saveComponent} className="space-y-4">
          <input value={compForm.code} onChange={(e) => setCompForm({ ...compForm, code: e.target.value })} placeholder="Code" className={inputClass} required />
          <input value={compForm.name} onChange={(e) => setCompForm({ ...compForm, name: e.target.value })} placeholder="Name" className={inputClass} required />
          <select value={compForm.kind} onChange={(e) => setCompForm({ ...compForm, kind: e.target.value })} className={inputClass}>
            {["earning", "deduction", "employer_cost"].map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
          </select>
        </form>
      </SlideOver>

      <SlideOver open={openStruct} title="Add salary structure" onClose={() => setOpenStruct(false)} footer={
        <button type="submit" form="struct-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Save</button>
      }>
        <form id="struct-form" onSubmit={saveStructure} className="space-y-4">
          <input value={structForm.code} onChange={(e) => setStructForm({ ...structForm, code: e.target.value })} placeholder="Code" className={inputClass} required />
          <input value={structForm.name} onChange={(e) => setStructForm({ ...structForm, name: e.target.value })} placeholder="Name" className={inputClass} required />
        </form>
      </SlideOver>
    </PageContent>
  );
}

interface AdjustmentRow {
  id: string;
  adjustmentType: string;
  amount: number | string;
  reason: string;
  staffProfileId: string;
}

export function PayrollAdjustmentsModule() {
  const { staff } = useOutletStaff();
  const [items, setItems] = useState<AdjustmentRow[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ payrollRunId: "", staffProfileId: "", adjustmentType: "arrear", amount: "", reason: "" });

  function load() {
    api<AdjustmentRow[]>("/hr/payroll-adjustments").then(setItems).catch(() => setItems([]));
  }

  useEffect(load, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/hr/payroll-adjustments", {
        method: "POST",
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setOpen(false);
      setMsg("Adjustment created");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Adjustments" description="Manual payroll adjustments with reason and audit trail." action={
        <button type="button" onClick={() => setOpen(true)} className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Add adjustment</button>
      } />
      <PayrollNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}
      <Panel title="Adjustments">
        {items.length === 0 ? <EmptyState title="No adjustments" /> : (
          <ul className="divide-y divide-gray-100 text-sm">
            {items.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex justify-between">
                  <span className="font-medium capitalize">{a.adjustmentType}</span>
                  <span>₹{Number(a.amount).toLocaleString("en-IN")}</span>
                </div>
                <p className="text-gray-500">{a.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <SlideOver open={open} title="Add adjustment" onClose={() => setOpen(false)} footer={
        <button type="submit" form="adj-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Save</button>
      }>
        <form id="adj-form" onSubmit={save} className="space-y-4">
          <input value={form.payrollRunId} onChange={(e) => setForm({ ...form, payrollRunId: e.target.value })} placeholder="Payroll run ID" className={inputClass} required />
          <select value={form.staffProfileId} onChange={(e) => setForm({ ...form, staffProfileId: e.target.value })} className={inputClass} required>
            <option value="">Employee...</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{formatStaffName(s)}</option>)}
          </select>
          <select value={form.adjustmentType} onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })} className={inputClass}>
            {["arrear", "reimbursement", "deduction", "bonus"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount" className={inputClass} required />
          <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason" rows={2} className={inputClass} required />
        </form>
      </SlideOver>
    </PageContent>
  );
}

export function StatutoryDeductionsModule() {
  const { staff } = useOutletStaff();
  const [staffProfileId, setStaffProfileId] = useState("");
  const [pf, setPf] = useState<Record<string, unknown> | null>(null);
  const [esi, setEsi] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState("");
  const [pfForm, setPfForm] = useState({ uan: "", pfAccount: "", enrolled: true });
  const [esiForm, setEsiForm] = useState({ esicNumber: "", enrolled: true });

  useEffect(() => {
    if (!staffProfileId) { setPf(null); setEsi(null); return; }
    api<Record<string, unknown> | null>(`/hr/statutory/pf/${staffProfileId}`).then(setPf).catch(() => setPf(null));
    api<Record<string, unknown> | null>(`/hr/statutory/esi/${staffProfileId}`).then(setEsi).catch(() => setEsi(null));
  }, [staffProfileId]);

  async function savePf(e: React.FormEvent) {
    e.preventDefault();
    if (!staffProfileId) return;
    try {
      await api(`/hr/statutory/pf/${staffProfileId}`, { method: "POST", body: JSON.stringify(pfForm) });
      setMsg("PF enrollment saved");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function saveEsi(e: React.FormEvent) {
    e.preventDefault();
    if (!staffProfileId) return;
    try {
      await api(`/hr/statutory/esi/${staffProfileId}`, { method: "POST", body: JSON.stringify(esiForm) });
      setMsg("ESI enrollment saved");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Statutory Deductions" description="PF, ESI, Professional Tax and other statutory enrollments." />
      <PayrollNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title="Employee statutory enrollments" className="mb-6 max-w-lg">
        <select value={staffProfileId} onChange={(e) => setStaffProfileId(e.target.value)} className={inputClass}>
          <option value="">Select employee...</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{formatStaffName(s)}</option>)}
        </select>
      </Panel>

      {staffProfileId && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Panel title={`PF enrollment ${pf ? "(existing)" : ""}`}>
            <form onSubmit={savePf} className="space-y-3">
              <input value={pfForm.uan} onChange={(e) => setPfForm({ ...pfForm, uan: e.target.value })} placeholder="UAN" className={inputClass} />
              <input value={pfForm.pfAccount} onChange={(e) => setPfForm({ ...pfForm, pfAccount: e.target.value })} placeholder="PF account" className={inputClass} />
              <button type="submit" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Save PF</button>
            </form>
          </Panel>
          <Panel title={`ESI enrollment ${esi ? "(existing)" : ""}`}>
            <form onSubmit={saveEsi} className="space-y-3">
              <input value={esiForm.esicNumber} onChange={(e) => setEsiForm({ ...esiForm, esicNumber: e.target.value })} placeholder="ESIC number" className={inputClass} />
              <button type="submit" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Save ESI</button>
            </form>
          </Panel>
        </div>
      )}
    </PageContent>
  );
}

interface LoanRow {
  id: string;
  loanType: string;
  principal: number | string;
  outstanding: number | string;
  status: string;
}

interface AdvanceRow {
  id: string;
  amount: number | string;
  recovered: number | string;
  status: string;
}

export function LoansAdvancesModule() {
  const { staff } = useOutletStaff();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [openLoan, setOpenLoan] = useState(false);
  const [openAdvance, setOpenAdvance] = useState(false);
  const [msg, setMsg] = useState("");
  const [loanForm, setLoanForm] = useState({ staffProfileId: "", loanType: "personal", principal: "", emiAmount: "", startDate: "" });
  const [advanceForm, setAdvanceForm] = useState({ staffProfileId: "", amount: "", reason: "" });

  function load() {
    api<LoanRow[]>("/hr/loans").then(setLoans).catch(() => setLoans([]));
    api<AdvanceRow[]>("/hr/advances").then(setAdvances).catch(() => setAdvances([]));
  }

  useEffect(load, []);

  async function saveLoan(e: React.FormEvent) {
    e.preventDefault();
    try {
      const principal = Number(loanForm.principal);
      await api("/hr/loans", {
        method: "POST",
        body: JSON.stringify({
          ...loanForm,
          principal,
          emiAmount: Number(loanForm.emiAmount),
          outstanding: principal,
          startDate: loanForm.startDate,
        }),
      });
      setOpenLoan(false);
      setMsg("Loan created");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function saveAdvance(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/hr/advances", {
        method: "POST",
        body: JSON.stringify({ ...advanceForm, amount: Number(advanceForm.amount) }),
      });
      setOpenAdvance(false);
      setMsg("Advance created");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Loans & Advances" description="Salary advances, employee loans and recovery schedules." action={
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpenAdvance(true)} className="border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium">Add advance</button>
          <button type="button" onClick={() => setOpenLoan(true)} className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Add loan</button>
        </div>
      } />
      <PayrollNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Loans">
          {loans.length === 0 ? <EmptyState title="No loans" /> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {loans.map((l) => (
                <li key={l.id} className="py-3 flex justify-between">
                  <span className="capitalize">{l.loanType}</span>
                  <span>₹{Number(l.outstanding).toLocaleString("en-IN")} · {l.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Advances">
          {advances.length === 0 ? <EmptyState title="No advances" /> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {advances.map((a) => (
                <li key={a.id} className="py-3 flex justify-between">
                  <span>₹{Number(a.amount).toLocaleString("en-IN")}</span>
                  <span className="capitalize">{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <SlideOver open={openLoan} title="Add loan" onClose={() => setOpenLoan(false)} footer={
        <button type="submit" form="loan-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Save</button>
      }>
        <form id="loan-form" onSubmit={saveLoan} className="space-y-4">
          <select value={loanForm.staffProfileId} onChange={(e) => setLoanForm({ ...loanForm, staffProfileId: e.target.value })} className={inputClass} required>
            <option value="">Employee...</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{formatStaffName(s)}</option>)}
          </select>
          <input type="number" value={loanForm.principal} onChange={(e) => setLoanForm({ ...loanForm, principal: e.target.value })} placeholder="Principal" className={inputClass} required />
          <input type="number" value={loanForm.emiAmount} onChange={(e) => setLoanForm({ ...loanForm, emiAmount: e.target.value })} placeholder="EMI amount" className={inputClass} required />
          <input type="date" value={loanForm.startDate} onChange={(e) => setLoanForm({ ...loanForm, startDate: e.target.value })} className={inputClass} required />
        </form>
      </SlideOver>

      <SlideOver open={openAdvance} title="Add advance" onClose={() => setOpenAdvance(false)} footer={
        <button type="submit" form="advance-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Save</button>
      }>
        <form id="advance-form" onSubmit={saveAdvance} className="space-y-4">
          <select value={advanceForm.staffProfileId} onChange={(e) => setAdvanceForm({ ...advanceForm, staffProfileId: e.target.value })} className={inputClass} required>
            <option value="">Employee...</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{formatStaffName(s)}</option>)}
          </select>
          <input type="number" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} placeholder="Amount" className={inputClass} required />
          <input value={advanceForm.reason} onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })} placeholder="Reason" className={inputClass} />
        </form>
      </SlideOver>
    </PageContent>
  );
}

export function BonusIncentivesModule() {
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ code: "", name: "" });

  function load() {
    api<SalaryComponent[]>("/hr/salary-components").then((c) => setComponents(c.filter((x) => x.kind === "earning"))).catch(() => setComponents([]));
  }

  useEffect(load, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/hr/salary-components", {
        method: "POST",
        body: JSON.stringify({ ...form, kind: "earning", includeInBonus: true }),
      });
      setOpen(false);
      setMsg("Bonus component created");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Bonus & Incentives" description="Statutory and discretionary bonus components." action={
        <button type="button" onClick={() => setOpen(true)} className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Add bonus component</button>
      } />
      <PayrollNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}
      <Panel title="Bonus-eligible components">
        {components.length === 0 ? <EmptyState title="No bonus components" /> : (
          <ul className="divide-y divide-gray-100 text-sm">
            {components.map((c) => (
              <li key={c.id} className="py-3 flex justify-between">
                <span>{c.name}</span>
                <span className="text-gray-400">{c.code}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <SlideOver open={open} title="Add bonus component" onClose={() => setOpen(false)} footer={
        <button type="submit" form="bonus-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Save</button>
      }>
        <form id="bonus-form" onSubmit={save} className="space-y-4">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Code" className={inputClass} required />
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (e.g. Festival bonus)" className={inputClass} required />
        </form>
      </SlideOver>
    </PageContent>
  );
}

interface SettlementRow {
  id: string;
  lastWorkingDay: string;
  status: string;
  netAmount: number | string;
}

export function FinalSettlementsModule() {
  const { staff } = useOutletStaff();
  const [items, setItems] = useState<SettlementRow[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ staffProfileId: "", lastWorkingDay: "" });

  function load() {
    api<SettlementRow[]>("/hr/settlements").then(setItems).catch(() => setItems([]));
  }

  useEffect(load, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/hr/settlements", { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      setMsg("Settlement initiated");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Final Settlements" description="Full and final settlement on employee exit." action={
        <button type="button" onClick={() => setOpen(true)} className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Initiate settlement</button>
      } />
      <PayrollNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}
      <Panel title="Settlements">
        {items.length === 0 ? <EmptyState title="No settlements" /> : (
          <ul className="divide-y divide-gray-100 text-sm">
            {items.map((s) => (
              <li key={s.id} className="py-3 flex justify-between">
                <span>{new Date(s.lastWorkingDay).toLocaleDateString()}</span>
                <span>₹{Number(s.netAmount).toLocaleString("en-IN")} · {s.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <SlideOver open={open} title="Initiate settlement" onClose={() => setOpen(false)} footer={
        <button type="submit" form="settlement-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Save</button>
      }>
        <form id="settlement-form" onSubmit={save} className="space-y-4">
          <select value={form.staffProfileId} onChange={(e) => setForm({ ...form, staffProfileId: e.target.value })} className={inputClass} required>
            <option value="">Employee...</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{formatStaffName(s)}</option>)}
          </select>
          <input type="date" value={form.lastWorkingDay} onChange={(e) => setForm({ ...form, lastWorkingDay: e.target.value })} className={inputClass} required />
        </form>
      </SlideOver>
    </PageContent>
  );
}

interface PaymentRow {
  id: string;
  amount: number | string;
  paymentMode: string;
  status: string;
}

export function PayrollPaymentsModule() {
  const { staff } = useOutletStaff();
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ payrollRunId: "", staffProfileId: "", amount: "", paymentMode: "bank_transfer" });

  function load() {
    api<PaymentRow[]>("/hr/payroll-payments").then(setItems).catch(() => setItems([]));
  }

  useEffect(load, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/hr/payroll-payments", {
        method: "POST",
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setOpen(false);
      setMsg("Payment recorded");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Payments" description="Bank transfer batches and payment tracking." action={
        <button type="button" onClick={() => setOpen(true)} className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Record payment</button>
      } />
      <PayrollNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}
      <Panel title="Payments">
        {items.length === 0 ? <EmptyState title="No payments" /> : (
          <ul className="divide-y divide-gray-100 text-sm">
            {items.map((p) => (
              <li key={p.id} className="py-3 flex justify-between">
                <span className="capitalize">{p.paymentMode.replace("_", " ")}</span>
                <span>₹{Number(p.amount).toLocaleString("en-IN")} · {p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <SlideOver open={open} title="Record payment" onClose={() => setOpen(false)} footer={
        <button type="submit" form="payment-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Save</button>
      }>
        <form id="payment-form" onSubmit={save} className="space-y-4">
          <input value={form.payrollRunId} onChange={(e) => setForm({ ...form, payrollRunId: e.target.value })} placeholder="Payroll run ID" className={inputClass} required />
          <select value={form.staffProfileId} onChange={(e) => setForm({ ...form, staffProfileId: e.target.value })} className={inputClass} required>
            <option value="">Employee...</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{formatStaffName(s)}</option>)}
          </select>
          <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount" className={inputClass} required />
          <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })} className={inputClass}>
            {["bank_transfer", "cash", "cheque"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
          </select>
        </form>
      </SlideOver>
    </PageContent>
  );
}

interface LabourCostReport {
  monthlyHeadcount: number;
  estimatedMonthlyCost: number;
  avgCostPerEmployee: number;
}

interface OvertimeRisk {
  pendingRequests: number;
  approvedThisMonth: number;
  riskLevel: string;
}

export function PayrollReportsModule() {
  const outletId = getOutletId();
  const [labour, setLabour] = useState<LabourCostReport | null>(null);
  const [overtime, setOvertime] = useState<OvertimeRisk | null>(null);

  useEffect(() => {
    const q = outletId ? `?outletId=${outletId}` : "";
    api<LabourCostReport>(`/hr/analytics/labour-cost${q}`).then(setLabour).catch(() => setLabour(null));
    api<OvertimeRisk>(`/hr/analytics/overtime-risk${q}`).then(setOvertime).catch(() => setOvertime(null));
  }, [outletId]);

  return (
    <PageContent>
      <PageHeader title="Payroll Reports" description="Payroll register, cost analysis and compliance reports." />
      <PayrollNav />
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Headcount" value={String(labour?.monthlyHeadcount ?? 0)} />
        <MetricCard label="Est. monthly cost" value={labour ? `₹${labour.estimatedMonthlyCost.toLocaleString("en-IN")}` : "—"} />
        <MetricCard label="Avg cost / employee" value={labour ? `₹${labour.avgCostPerEmployee.toLocaleString("en-IN")}` : "—"} />
      </div>
      <Panel title="Overtime risk">
        {overtime ? (
          <div className="text-sm space-y-2">
            <p>Pending requests: <strong>{overtime.pendingRequests}</strong></p>
            <p>Approved this month: <strong>{overtime.approvedThisMonth}</strong></p>
            <p>Risk level: <span className="capitalize font-medium">{overtime.riskLevel}</span></p>
          </div>
        ) : (
          <EmptyState title="No overtime data" />
        )}
      </Panel>
    </PageContent>
  );
}

interface JurisdictionRow {
  id: string;
  stateCode: string;
  stateName: string;
}

interface RegistrationRow {
  id: string;
  type: string;
  registrationNo: string;
}

export function PayrollSettingsModule() {
  const [jurisdictions, setJurisdictions] = useState<JurisdictionRow[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [openJ, setOpenJ] = useState(false);
  const [openR, setOpenR] = useState(false);
  const [msg, setMsg] = useState("");
  const [jForm, setJForm] = useState({ stateCode: "", stateName: "" });
  const [rForm, setRForm] = useState({ jurisdictionId: "", type: "epfo", registrationNo: "" });
  const outletId = getOutletId();

  function load() {
    api<JurisdictionRow[]>("/hr/compliance/jurisdictions").then(setJurisdictions).catch(() => setJurisdictions([]));
    const q = outletId ? `?outletId=${outletId}` : "";
    api<RegistrationRow[]>(`/hr/compliance/registrations${q}`).then(setRegistrations).catch(() => setRegistrations([]));
  }

  useEffect(load, [outletId]);

  async function saveJurisdiction(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/hr/compliance/jurisdictions", { method: "POST", body: JSON.stringify(jForm) });
      setOpenJ(false);
      setMsg("Jurisdiction added");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function saveRegistration(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/hr/compliance/registrations", {
        method: "POST",
        body: JSON.stringify({ ...rForm, outletId: outletId || undefined }),
      });
      setOpenR(false);
      setMsg("Registration added");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Payroll Settings" description="Compliance jurisdictions and outlet registrations." action={
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpenR(true)} className="border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium">Add registration</button>
          <button type="button" onClick={() => setOpenJ(true)} className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Add jurisdiction</button>
        </div>
      } />
      <PayrollNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Jurisdictions">
          {jurisdictions.length === 0 ? <EmptyState title="No jurisdictions" /> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {jurisdictions.map((j) => (
                <li key={j.id} className="py-3 flex justify-between">
                  <span>{j.stateName}</span>
                  <span className="text-gray-400">{j.stateCode}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Registrations">
          {registrations.length === 0 ? <EmptyState title="No registrations" /> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {registrations.map((r) => (
                <li key={r.id} className="py-3 flex justify-between">
                  <span className="uppercase">{r.type}</span>
                  <span>{r.registrationNo}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <SlideOver open={openJ} title="Add jurisdiction" onClose={() => setOpenJ(false)} footer={
        <button type="submit" form="j-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Save</button>
      }>
        <form id="j-form" onSubmit={saveJurisdiction} className="space-y-4">
          <input value={jForm.stateCode} onChange={(e) => setJForm({ ...jForm, stateCode: e.target.value })} placeholder="State code (e.g. KA)" className={inputClass} required />
          <input value={jForm.stateName} onChange={(e) => setJForm({ ...jForm, stateName: e.target.value })} placeholder="State name" className={inputClass} required />
        </form>
      </SlideOver>

      <SlideOver open={openR} title="Add registration" onClose={() => setOpenR(false)} footer={
        <button type="submit" form="r-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Save</button>
      }>
        <form id="r-form" onSubmit={saveRegistration} className="space-y-4">
          <select value={rForm.jurisdictionId} onChange={(e) => setRForm({ ...rForm, jurisdictionId: e.target.value })} className={inputClass} required>
            <option value="">Jurisdiction...</option>
            {jurisdictions.map((j) => <option key={j.id} value={j.id}>{j.stateName}</option>)}
          </select>
          <select value={rForm.type} onChange={(e) => setRForm({ ...rForm, type: e.target.value })} className={inputClass}>
            {["epfo", "esic", "pt", "lwf", "shops_establishments", "fssai"].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
          <input value={rForm.registrationNo} onChange={(e) => setRForm({ ...rForm, registrationNo: e.target.value })} placeholder="Registration number" className={inputClass} required />
        </form>
      </SlideOver>
    </PageContent>
  );
}
