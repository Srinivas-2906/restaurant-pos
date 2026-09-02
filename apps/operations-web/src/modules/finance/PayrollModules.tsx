"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getOutletId, monthRange, API_URL } from "@/lib/api";
import { PayrollNav } from "./PayrollNav";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageContent } from "@/components/shell/PageContent";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@kaana/ui";

interface PayrollRun {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  totalGross: number | string;
  totalNet: number | string;
}

export function PayrollModule() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [msg, setMsg] = useState("");
  const outletId = getOutletId();
  const { from, to } = monthRange();

  function load() {
    api<PayrollRun[]>("/payroll/runs").then(setRuns).catch(() => setRuns([]));
  }

  useEffect(load, []);

  async function createRun() {
    try {
      await api("/payroll/runs", { method: "POST", body: JSON.stringify({ outletId, periodStart: from, periodEnd: to }) });
      setMsg("Payroll run created");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <PageContent>
      <PageHeader
        title="Payroll Runs"
        description="Create, validate and approve payroll runs."
        action={
          <button type="button" onClick={createRun} className="bg-kaana hover:bg-kaana-dark text-white px-4 py-2 rounded-xl text-sm font-medium">
            Run payroll (this month)
          </button>
        }
      />
      <PayrollNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}
      <div className="space-y-3">
        {runs.length === 0 ? (
          <Panel><EmptyState title="No payroll runs" description="Create a payroll run for the current month." /></Panel>
        ) : (
          runs.map((run) => (
            <Link key={run.id} href={`/payroll/runs/${run.id}`}>
              <Panel className="hover:border-kaana/40 transition-colors cursor-pointer">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold capitalize">{run.status}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(run.periodStart).toLocaleDateString()} – {new Date(run.periodEnd).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Gross {formatCurrency(Number(run.totalGross))} · Net {formatCurrency(Number(run.totalNet))}
                    </p>
                  </div>
                  <span className="text-sm text-kaana font-medium">View →</span>
                </div>
              </Panel>
            </Link>
          ))
        )}
      </div>
    </PageContent>
  );
}

interface RunDetail {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  totalGross: number | string;
  totalNet: number | string;
  payslips: Array<{
    id: string;
    grossPay: number | string;
    netPay: number | string;
    staff: { employeeCode: string; displayName?: string | null; legalName?: string | null; firstName?: string | null; lastName?: string | null; user?: { firstName: string; lastName: string | null } | null };
  }>;
}

export function PayrollRunDetailModule({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [msg, setMsg] = useState("");

  function load() {
    api<RunDetail>(`/payroll/runs/${runId}`).then(setRun).catch(() => setRun(null));
  }

  useEffect(load, [runId]);

  async function approve() {
    await api(`/payroll/runs/${runId}/approve`, { method: "POST" });
    setMsg("Payroll approved");
    load();
  }

  async function markPaid() {
    await api(`/payroll/runs/${runId}/mark-paid`, { method: "POST" });
    setMsg("Marked as paid");
    load();
  }

  async function exportCsv() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/payroll/runs/${runId}/export.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payroll-${runId.slice(-8)}.csv`;
    a.click();
  }

  return (
    <PageContent>
      <PageHeader
        title="Payroll run"
        description={run ? `${new Date(run.periodStart).toLocaleDateString()} – ${new Date(run.periodEnd).toLocaleDateString()}` : "Loading..."}
        action={
          run && (
            <div className="flex gap-2 flex-wrap">
              {run.status === "draft" && (
                <button type="button" onClick={approve} className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Approve</button>
              )}
              {run.status === "approved" && (
                <button type="button" onClick={markPaid} className="bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium">Mark paid</button>
              )}
              <button type="button" onClick={exportCsv} className="border border-gray-200 px-4 py-2 rounded-xl text-sm font-medium">Export CSV</button>
            </div>
          )
        }
      />
      <PayrollNav />
      {msg && <p className="text-sm mb-4 text-green-700">{msg}</p>}
      {run && (
        <>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Panel><p className="text-sm text-gray-500">Status</p><p className="font-semibold capitalize">{run.status}</p></Panel>
            <Panel><p className="text-sm text-gray-500">Total gross</p><p className="font-semibold">{formatCurrency(Number(run.totalGross))}</p></Panel>
            <Panel><p className="text-sm text-gray-500">Total net</p><p className="font-semibold">{formatCurrency(Number(run.totalNet))}</p></Panel>
          </div>
          <Panel title="Payslips">
            {run.payslips.length === 0 ? (
              <EmptyState title="No payslips" description="No staff with attendance in this period." />
            ) : (
              <div className="overflow-x-auto -mx-5 -mb-5">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3">Employee</th>
                      <th className="text-left p-3">Code</th>
                      <th className="text-left p-3">Gross</th>
                      <th className="text-left p-3">Net</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {run.payslips.map((s) => (
                      <tr key={s.id} className="border-t border-gray-100">
                        <td className="p-3">{s.staff.displayName || s.staff.legalName || `${s.staff.firstName ?? s.staff.user?.firstName ?? ""} ${s.staff.lastName ?? s.staff.user?.lastName ?? ""}`.trim()}</td>
                        <td className="p-3">{s.staff.employeeCode}</td>
                        <td className="p-3">{formatCurrency(Number(s.grossPay))}</td>
                        <td className="p-3">{formatCurrency(Number(s.netPay))}</td>
                        <td className="p-3">
                          <Link href={`/payroll/runs/${runId}/payslip/${s.id}`} className="text-kaana font-medium hover:underline">View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </PageContent>
  );
}

interface PayslipDetail {
  id: string;
  grossPay: number | string;
  deductions: number | string;
  netPay: number | string;
  hoursWorked: number | string | null;
  breakdown: Record<string, number>;
  payrollRun: { periodStart: string; periodEnd: string; organization: { name: string }; outlet?: { name: string } | null };
  staff: {
    employeeCode: string;
    displayName?: string | null;
    legalName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
    ifsc?: string | null;
    department?: { name: string } | null;
    designation?: { name: string } | null;
    user?: { firstName: string; lastName: string | null; email: string } | null;
  };
}

export function PayslipModule({ runId, payslipId }: { runId: string; payslipId: string }) {
  const [slip, setSlip] = useState<PayslipDetail | null>(null);

  useEffect(() => {
    api<PayslipDetail>(`/payroll/payslips/${payslipId}`).then(setSlip).catch(() => setSlip(null));
  }, [payslipId]);

  function printPayslip() {
    window.print();
  }

  if (!slip) {
    return <PageContent><p className="text-gray-400">Loading payslip...</p></PageContent>;
  }

  const name =
    slip.staff.displayName?.trim() ||
    slip.staff.legalName?.trim() ||
    `${slip.staff.firstName ?? slip.staff.user?.firstName ?? ""} ${slip.staff.lastName ?? slip.staff.user?.lastName ?? ""}`.trim();
  const breakdown = slip.breakdown ?? {};

  return (
    <PageContent>
      <PageHeader
        title="Payslip"
        description={`${name} · ${slip.staff.employeeCode}`}
        action={
          <div className="flex gap-2">
            <Link href={`/payroll/runs/${runId}`} className="border border-gray-200 px-4 py-2 rounded-xl text-sm">Back</Link>
            <button type="button" onClick={printPayslip} className="bg-kaana text-white px-4 py-2 rounded-xl text-sm font-medium">Print</button>
          </div>
        }
      />
      <PayrollNav />

      <div id="payslip-document" className="bg-white border border-gray-200 rounded-xl p-8 max-w-3xl print:border-0 print:shadow-none">
        <div className="text-center border-b border-gray-200 pb-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900">{slip.payrollRun.organization.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Payslip</p>
          <p className="text-sm text-gray-600 mt-2">
            {new Date(slip.payrollRun.periodStart).toLocaleDateString()} – {new Date(slip.payrollRun.periodEnd).toLocaleDateString()}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6 text-sm">
          <div className="space-y-2">
            <p><span className="text-gray-500">Employee:</span> <strong>{name}</strong></p>
            <p><span className="text-gray-500">Code:</span> {slip.staff.employeeCode}</p>
            <p><span className="text-gray-500">Department:</span> {slip.staff.department?.name ?? "—"}</p>
            <p><span className="text-gray-500">Designation:</span> {slip.staff.designation?.name ?? "—"}</p>
          </div>
          <div className="space-y-2">
            <p><span className="text-gray-500">Bank:</span> {slip.staff.bankName ?? "—"}</p>
            <p><span className="text-gray-500">Account:</span> {slip.staff.bankAccount ?? "—"}</p>
            <p><span className="text-gray-500">IFSC:</span> {slip.staff.ifsc ?? "—"}</p>
            <p><span className="text-gray-500">Hours worked:</span> {slip.hoursWorked ?? "—"}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Panel title="Earnings">
            <div className="flex justify-between py-2 text-sm"><span>Gross pay</span><strong>{formatCurrency(Number(slip.grossPay))}</strong></div>
          </Panel>
          <Panel title="Deductions">
            {Object.entries(breakdown).filter(([k]) => ["pf", "esi"].includes(k)).map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 text-sm capitalize"><span>{k}</span><span>{formatCurrency(v)}</span></div>
            ))}
            <div className="flex justify-between py-2 text-sm border-t border-gray-100 mt-2 font-medium">
              <span>Total deductions</span><span>{formatCurrency(Number(slip.deductions))}</span>
            </div>
          </Panel>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-xl flex justify-between items-center">
          <span className="font-semibold">Net pay</span>
          <span className="text-xl font-bold text-kaana">{formatCurrency(Number(slip.netPay))}</span>
        </div>

        {(breakdown.workedDays != null || breakdown.payableDays != null) && (
          <div className="mt-6 text-sm text-gray-600">
            <p>Worked days: {breakdown.workedDays ?? "—"} · Payable days: {breakdown.payableDays ?? "—"} · Paid leave: {breakdown.paidLeaveDays ?? 0}</p>
          </div>
        )}
      </div>
    </PageContent>
  );
}
