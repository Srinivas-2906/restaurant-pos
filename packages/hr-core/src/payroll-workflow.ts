import type { PayrollRunWorkflowStatus } from "./types";

const TRANSITIONS: Record<PayrollRunWorkflowStatus, PayrollRunWorkflowStatus[]> = {
  not_started: ["attendance_pending"],
  attendance_pending: ["inputs_pending", "draft"],
  inputs_pending: ["draft", "validation_failed"],
  draft: ["validation_failed", "pending_approval"],
  validation_failed: ["draft", "inputs_pending"],
  pending_approval: ["approved", "draft"],
  approved: ["payment_processing"],
  payment_processing: ["paid", "approved"],
  paid: ["statutory_filing_pending"],
  statutory_filing_pending: ["completed"],
  completed: ["reopened"],
  reopened: ["attendance_pending", "inputs_pending"],
};

export function canTransitionPayroll(from: PayrollRunWorkflowStatus, to: PayrollRunWorkflowStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextPayrollStatuses(current: PayrollRunWorkflowStatus): PayrollRunWorkflowStatus[] {
  return TRANSITIONS[current] ?? [];
}

export function mapLegacyPayrollStatus(status: string): PayrollRunWorkflowStatus {
  if (status === "draft") return "draft";
  if (status === "approved") return "approved";
  if (status === "paid") return "paid";
  return status as PayrollRunWorkflowStatus;
}

export function wagePaymentDueDate(periodEnd: Date, wagePeriod: "daily" | "weekly" | "fortnightly" | "monthly" = "monthly"): Date {
  const d = new Date(periodEnd);
  switch (wagePeriod) {
    case "daily":
      return d;
    case "weekly":
      return d;
    case "fortnightly":
      d.setDate(d.getDate() + 2);
      return d;
    case "monthly":
    default:
      d.setMonth(d.getMonth() + 1);
      d.setDate(7);
      return d;
  }
}

export function finalWagesDueDate(lastWorkingDay: Date): Date {
  const d = new Date(lastWorkingDay);
  let added = 0;
  while (added < 2) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d;
}
