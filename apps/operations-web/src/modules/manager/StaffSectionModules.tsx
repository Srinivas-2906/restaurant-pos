"use client";

import { useEffect, useState } from "react";
import { api, getOutletId, getUser } from "@/lib/api";
import { StaffNav } from "./StaffNav";
import { PageContent } from "@/components/shell/PageContent";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver } from "@/components/ui/SlideOver";
import { MetricCard } from "@/components/ui/MetricCard";

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

const inputClass = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm";

function formatStaffName(s: StaffRow) {
  if (s.displayName?.trim()) return s.displayName.trim();
  if (s.legalName?.trim()) return s.legalName.trim();
  if (s.firstName?.trim()) return `${s.firstName} ${s.lastName ?? ""}`.trim();
  if (s.user) return `${s.user.firstName} ${s.user.lastName ?? ""}`.trim();
  return s.employeeCode ?? s.id.slice(0, 8);
}

function orgId() {
  const org = getUser()?.organization as { id?: string } | undefined;
  return org?.id ?? null;
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

interface DocumentRow {
  id: string;
  documentType: string;
  category: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  verificationStatus: string;
  staffProfileId: string;
}

export function DocumentsModule() {
  const { outletId, staff } = useOutletStaff();
  const [items, setItems] = useState<DocumentRow[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ staffProfileId: "", documentType: "", issueDate: "", expiryDate: "", notes: "" });

  function load() {
    if (!outletId) return;
    api<DocumentRow[]>(`/hr/documents?outletId=${outletId}`).then(setItems).catch(() => setItems([]));
  }

  useEffect(load, [outletId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/hr/documents", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          category: "other",
          issueDate: form.issueDate || undefined,
          expiryDate: form.expiryDate || undefined,
        }),
      });
      setOpen(false);
      setMsg("Document added");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader
        title="Compliance Documents"
        description="Identity, statutory, employment and restaurant-specific documents with expiry tracking."
        action={
          <button type="button" onClick={() => setOpen(true)} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
            Add document
          </button>
        }
      />
      <StaffNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title="Documents">
        {items.length === 0 ? (
          <EmptyState title="No documents" description="Add compliance documents for staff." />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-left p-3">Expiry</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id} className="border-t border-gray-100">
                    <td className="p-3">{d.documentType}</td>
                    <td className="p-3 capitalize">{d.category}</td>
                    <td className="p-3">{d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : "—"}</td>
                    <td className="p-3 capitalize">{d.verificationStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <SlideOver
        open={open}
        title="Add document"
        onClose={() => setOpen(false)}
        footer={
          <button type="submit" form="doc-form" className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium w-full">
            Save
          </button>
        }
      >
        <form id="doc-form" onSubmit={save} className="space-y-4">
          <select value={form.staffProfileId} onChange={(e) => setForm({ ...form, staffProfileId: e.target.value })} className={inputClass} required>
            <option value="">Employee...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{formatStaffName(s)}</option>
            ))}
          </select>
          <input value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })} placeholder="Document type" className={inputClass} required />
          <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className={inputClass} />
          <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={inputClass} />
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" rows={2} className={inputClass} />
        </form>
      </SlideOver>
    </PageContent>
  );
}

interface MedicalRecord {
  isFoodHandler?: boolean;
  medicalExamDate?: string | null;
  certificateExpiry?: string | null;
  fitStatus?: string;
  fostacStatus?: string | null;
  practitionerName?: string | null;
}

export function TrainingHealthModule() {
  const { staff } = useOutletStaff();
  const [staffProfileId, setStaffProfileId] = useState("");
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [form, setForm] = useState({ isFoodHandler: false, medicalExamDate: "", certificateExpiry: "", fitStatus: "fit", fostacStatus: "", practitionerName: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!staffProfileId) { setRecord(null); return; }
    api<MedicalRecord | null>(`/hr/medical/${staffProfileId}`)
      .then((r) => {
        setRecord(r);
        if (r) {
          setForm({
            isFoodHandler: r.isFoodHandler ?? false,
            medicalExamDate: r.medicalExamDate?.slice(0, 10) ?? "",
            certificateExpiry: r.certificateExpiry?.slice(0, 10) ?? "",
            fitStatus: r.fitStatus ?? "fit",
            fostacStatus: r.fostacStatus ?? "",
            practitionerName: r.practitionerName ?? "",
          });
        }
      })
      .catch(() => setRecord(null));
  }, [staffProfileId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!staffProfileId) return;
    try {
      await api(`/hr/medical/${staffProfileId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          medicalExamDate: form.medicalExamDate || undefined,
          certificateExpiry: form.certificateExpiry || undefined,
        }),
      });
      setMsg("Medical record saved");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader title="Training & Health" description="Food-safety medical examinations, FoSTaC training and hygiene compliance." />
      <StaffNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title="Medical & food-handler record" className="max-w-lg">
        <form onSubmit={save} className="space-y-4">
          <select value={staffProfileId} onChange={(e) => setStaffProfileId(e.target.value)} className={inputClass} required>
            <option value="">Select employee...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{formatStaffName(s)}</option>
            ))}
          </select>
          {staffProfileId && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isFoodHandler} onChange={(e) => setForm({ ...form, isFoodHandler: e.target.checked })} />
                Food handler
              </label>
              <input type="date" value={form.medicalExamDate} onChange={(e) => setForm({ ...form, medicalExamDate: e.target.value })} className={inputClass} />
              <input type="date" value={form.certificateExpiry} onChange={(e) => setForm({ ...form, certificateExpiry: e.target.value })} className={inputClass} />
              <select value={form.fitStatus} onChange={(e) => setForm({ ...form, fitStatus: e.target.value })} className={inputClass}>
                {["fit", "unfit", "restricted"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input value={form.fostacStatus} onChange={(e) => setForm({ ...form, fostacStatus: e.target.value })} placeholder="FoSTaC status" className={inputClass} />
              <input value={form.practitionerName} onChange={(e) => setForm({ ...form, practitionerName: e.target.value })} placeholder="Practitioner name" className={inputClass} />
              <button type="submit" className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
                {record ? "Update record" : "Create record"}
              </button>
            </>
          )}
        </form>
      </Panel>
    </PageContent>
  );
}

interface Threshold {
  label: string;
  met: boolean;
  current?: number;
  threshold?: number;
}

interface ComplianceDashboard {
  employeeCount: number;
  contractWorkerCount: number;
  thresholds: Threshold[];
  rulePack?: { state?: string };
}

interface CalendarItem {
  title: string;
  dueDay?: number;
  frequency?: string;
  description?: string;
}

export function StaffComplianceModule() {
  const outletId = getOutletId();
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);

  useEffect(() => {
    const q = outletId ? `?outletId=${outletId}` : "";
    api<ComplianceDashboard>(`/hr/compliance/dashboard${q}`).then(setDashboard).catch(() => setDashboard(null));
    api<CalendarItem[]>("/hr/compliance/calendar").then(setCalendar).catch(() => setCalendar([]));
  }, [outletId]);

  return (
    <PageContent>
      <PageHeader title="Compliance" description="Establishment registrations, threshold cards and compliance calendar." />
      <StaffNav />

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Active employees" value={String(dashboard?.employeeCount ?? 0)} />
        <MetricCard label="Contract workers" value={String(dashboard?.contractWorkerCount ?? 0)} />
        <MetricCard label="Jurisdiction" value={dashboard?.rulePack?.state ?? "—"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Threshold alerts">
          {(dashboard?.thresholds.length ?? 0) === 0 ? (
            <EmptyState title="No threshold data" />
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {dashboard?.thresholds.map((t) => (
                <li key={t.label} className="py-3 flex justify-between items-center">
                  <span>{t.label}</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${t.met ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    {t.met ? "Met" : "Action needed"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Compliance calendar">
          {calendar.length === 0 ? (
            <EmptyState title="No calendar entries" />
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {calendar.map((c, i) => (
                <li key={i} className="py-3">
                  <p className="font-medium">{c.title}</p>
                  <p className="text-gray-500">{c.frequency ?? "monthly"} · day {c.dueDay ?? "—"}</p>
                  {c.description && <p className="text-gray-500 text-xs mt-1">{c.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageContent>
  );
}

interface ContractorRow {
  id: string;
  name: string;
  gstin?: string | null;
  status: string;
}

interface AgreementRow {
  id: string;
  contractorId: string;
  startDate: string;
  endDate?: string | null;
  workerCount: number;
  licenceNo?: string | null;
}

export function ContractorsModule() {
  const [contractors, setContractors] = useState<ContractorRow[]>([]);
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [openContractor, setOpenContractor] = useState(false);
  const [openAgreement, setOpenAgreement] = useState(false);
  const [msg, setMsg] = useState("");
  const [contractorForm, setContractorForm] = useState({ name: "", gstin: "", contactPhone: "" });
  const [agreementForm, setAgreementForm] = useState({ contractorId: "", startDate: "", endDate: "", workerCount: "0", licenceNo: "" });
  const outletId = getOutletId();

  function load() {
    api<ContractorRow[]>("/hr/contractors").then(setContractors).catch(() => setContractors([]));
    api<AgreementRow[]>("/hr/contract-agreements").then(setAgreements).catch(() => setAgreements([]));
  }

  useEffect(load, []);

  async function saveContractor(e: React.FormEvent) {
    e.preventDefault();
    const organizationId = orgId();
    if (!organizationId) return;
    try {
      await api("/hr/contractors", { method: "POST", body: JSON.stringify({ ...contractorForm, organizationId }) });
      setOpenContractor(false);
      setMsg("Contractor added");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function saveAgreement(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/hr/contract-agreements", {
        method: "POST",
        body: JSON.stringify({
          ...agreementForm,
          outletId: outletId || undefined,
          workerCount: Number(agreementForm.workerCount),
          endDate: agreementForm.endDate || undefined,
        }),
      });
      setOpenAgreement(false);
      setMsg("Agreement added");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader
        title="Contractors"
        description="Agency staff, contract labour and principal-employer compliance."
        action={
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpenAgreement(true)} className="border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium">Add agreement</button>
            <button type="button" onClick={() => setOpenContractor(true)} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">Add contractor</button>
          </div>
        }
      />
      <StaffNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Contractors">
          {contractors.length === 0 ? <EmptyState title="No contractors" /> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {contractors.map((c) => (
                <li key={c.id} className="py-3 flex justify-between">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    {c.gstin && <p className="text-gray-500">{c.gstin}</p>}
                  </div>
                  <span className="capitalize text-gray-500">{c.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Agreements">
          {agreements.length === 0 ? <EmptyState title="No agreements" /> : (
            <ul className="divide-y divide-gray-100 text-sm">
              {agreements.map((a) => (
                <li key={a.id} className="py-3">
                  <p className="font-medium">{contractors.find((c) => c.id === a.contractorId)?.name ?? a.contractorId}</p>
                  <p className="text-gray-500">
                    {new Date(a.startDate).toLocaleDateString()} – {a.endDate ? new Date(a.endDate).toLocaleDateString() : "open"} · {a.workerCount} workers
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <SlideOver open={openContractor} title="Add contractor" onClose={() => setOpenContractor(false)} footer={
        <button type="submit" form="contractor-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Save</button>
      }>
        <form id="contractor-form" onSubmit={saveContractor} className="space-y-4">
          <input value={contractorForm.name} onChange={(e) => setContractorForm({ ...contractorForm, name: e.target.value })} placeholder="Contractor name" className={inputClass} required />
          <input value={contractorForm.gstin} onChange={(e) => setContractorForm({ ...contractorForm, gstin: e.target.value })} placeholder="GSTIN" className={inputClass} />
          <input value={contractorForm.contactPhone} onChange={(e) => setContractorForm({ ...contractorForm, contactPhone: e.target.value })} placeholder="Contact phone" className={inputClass} />
        </form>
      </SlideOver>

      <SlideOver open={openAgreement} title="Add agreement" onClose={() => setOpenAgreement(false)} footer={
        <button type="submit" form="agreement-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Save</button>
      }>
        <form id="agreement-form" onSubmit={saveAgreement} className="space-y-4">
          <select value={agreementForm.contractorId} onChange={(e) => setAgreementForm({ ...agreementForm, contractorId: e.target.value })} className={inputClass} required>
            <option value="">Contractor...</option>
            {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={agreementForm.startDate} onChange={(e) => setAgreementForm({ ...agreementForm, startDate: e.target.value })} className={inputClass} required />
          <input type="date" value={agreementForm.endDate} onChange={(e) => setAgreementForm({ ...agreementForm, endDate: e.target.value })} className={inputClass} />
          <input type="number" value={agreementForm.workerCount} onChange={(e) => setAgreementForm({ ...agreementForm, workerCount: e.target.value })} placeholder="Worker count" className={inputClass} />
          <input value={agreementForm.licenceNo} onChange={(e) => setAgreementForm({ ...agreementForm, licenceNo: e.target.value })} placeholder="Licence no." className={inputClass} />
        </form>
      </SlideOver>
    </PageContent>
  );
}

interface GrievanceRow {
  id: string;
  grievanceType: string;
  summary: string;
  status: string;
  createdAt: string;
}

export function GrievancesModule() {
  const { outletId, staff } = useOutletStaff();
  const [items, setItems] = useState<GrievanceRow[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ staffProfileId: "", grievanceType: "general", summary: "" });

  function load() {
    const q = outletId ? `?outletId=${outletId}` : "";
    api<GrievanceRow[]>(`/hr/grievances${q}`).then(setItems).catch(() => setItems([]));
  }

  useEffect(load, [outletId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const organizationId = orgId();
    if (!organizationId) return;
    try {
      await api("/hr/grievances", {
        method: "POST",
        body: JSON.stringify({ ...form, organizationId, outletId: outletId || undefined, staffProfileId: form.staffProfileId || undefined }),
      });
      setOpen(false);
      setMsg("Grievance filed");
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader
        title="Grievances"
        description="General grievances and access-restricted POSH complaint handling."
        action={
          <button type="button" onClick={() => setOpen(true)} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">File grievance</button>
        }
      />
      <StaffNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}

      <Panel title="Grievance cases">
        {items.length === 0 ? <EmptyState title="No grievances" /> : (
          <ul className="divide-y divide-gray-100 text-sm">
            {items.map((g) => (
              <li key={g.id} className="py-3">
                <div className="flex justify-between">
                  <span className="font-medium capitalize">{g.grievanceType}</span>
                  <span className="capitalize text-gray-500">{g.status}</span>
                </div>
                <p className="text-gray-600 mt-1">{g.summary}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(g.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <SlideOver open={open} title="File grievance" onClose={() => setOpen(false)} footer={
        <button type="submit" form="grievance-form" className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium w-full">Submit</button>
      }>
        <form id="grievance-form" onSubmit={save} className="space-y-4">
          <select value={form.staffProfileId} onChange={(e) => setForm({ ...form, staffProfileId: e.target.value })} className={inputClass}>
            <option value="">Employee (optional)</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{formatStaffName(s)}</option>)}
          </select>
          <select value={form.grievanceType} onChange={(e) => setForm({ ...form, grievanceType: e.target.value })} className={inputClass}>
            {["general", "harassment", "wages", "working_conditions", "other"].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
          <textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Summary" rows={4} className={inputClass} required />
        </form>
      </SlideOver>
    </PageContent>
  );
}

interface ComplianceScore {
  score: number;
  met: number;
  total: number;
  thresholds: Threshold[];
}

export function StaffReportsModule() {
  const outletId = getOutletId();
  const [report, setReport] = useState<ComplianceScore | null>(null);

  useEffect(() => {
    const q = outletId ? `?outletId=${outletId}` : "";
    api<ComplianceScore>(`/hr/analytics/compliance-score${q}`).then(setReport).catch(() => setReport(null));
  }, [outletId]);

  return (
    <PageContent>
      <PageHeader title="Staff Reports" description="Headcount, attendance, leave, training and compliance reports." />
      <StaffNav />

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Compliance score" value={report ? `${report.score}%` : "—"} />
        <MetricCard label="Thresholds met" value={report ? `${report.met} / ${report.total}` : "—"} />
        <MetricCard label="Outlet" value={outletId ? "Selected" : "All"} />
      </div>

      <Panel title="Compliance breakdown">
        {(report?.thresholds.length ?? 0) === 0 ? (
          <EmptyState title="No compliance data" />
        ) : (
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Requirement</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {report?.thresholds.map((t) => (
                  <tr key={t.label} className="border-t border-gray-100">
                    <td className="p-3">{t.label}</td>
                    <td className="p-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${t.met ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {t.met ? "Compliant" : "Gap"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageContent>
  );
}
