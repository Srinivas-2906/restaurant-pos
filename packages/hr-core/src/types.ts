export interface SalaryComponentInput {
  code: string;
  name: string;
  type: "earning" | "deduction" | "employer_cost";
  amount: number;
  includeInPf?: boolean;
  includeInEsi?: boolean;
  includeInGratuity?: boolean;
  includeInOvertime?: boolean;
  includeInBonus?: boolean;
  taxable?: boolean;
  includeInCtc?: boolean;
  payslipVisible?: boolean;
}

export interface StatutoryRulePack {
  jurisdictionCode: string;
  effectiveFrom: string;
  pfEmployeeRate: number;
  pfEmployerRate: number;
  pfWageCeiling: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  esiWageCeiling: number;
  professionalTaxSlabs?: Array<{ from: number; to: number | null; amount: number }>;
  minimumMonthlyWage?: number;
  minimumDailyWage?: number;
  maxDeductionPercent?: number;
  excludedAllowanceCapPercent?: number;
}

export interface PayrollValidationIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  employeeId?: string;
  details?: Record<string, unknown>;
}

export interface ComplianceThreshold {
  code: string;
  label: string;
  threshold: number;
  current: number;
  met: boolean;
  obligation?: string;
}

export type PayrollRunWorkflowStatus =
  | "not_started"
  | "attendance_pending"
  | "inputs_pending"
  | "draft"
  | "validation_failed"
  | "pending_approval"
  | "approved"
  | "payment_processing"
  | "paid"
  | "statutory_filing_pending"
  | "completed"
  | "reopened";
