import type { PayrollValidationIssue, SalaryComponentInput } from "./types";

export interface WageRuleInput {
  basic: number;
  dearnessAllowance: number;
  retainingAllowance?: number;
  excludedComponents: number;
  totalRemuneration: number;
  excludedCapPercent?: number;
}

export interface WageRuleResult {
  coreWage: number;
  statutoryWage: number;
  permittedExcluded: number;
  actualExcluded: number;
  addedBack: number;
  explanation: string;
  affected: string[];
}

/** Code on Wages 50% test — excluded allowances capped relative to total remuneration. */
export function validateWageRule(input: WageRuleInput): WageRuleResult {
  const cap = input.excludedCapPercent ?? 50;
  const coreWage = input.basic + input.dearnessAllowance + (input.retainingAllowance ?? 0);
  const permittedExcluded = (input.totalRemuneration * cap) / 100;
  const actualExcluded = input.excludedComponents;
  const excess = Math.max(0, actualExcluded - permittedExcluded);
  const statutoryWage = coreWage + excess;
  const affected =
    excess > 0
      ? ["PF employee/employer", "EPS", "gratuity accrual", "overtime base", "statutory bonus base"]
      : [];

  return {
    coreWage,
    statutoryWage,
    permittedExcluded,
    actualExcluded,
    addedBack: excess,
    explanation:
      excess > 0
        ? `Basic + DA: ₹${coreWage.toLocaleString("en-IN")}. Total remuneration: ₹${input.totalRemuneration.toLocaleString("en-IN")}. Permitted excluded: ₹${permittedExcluded.toLocaleString("en-IN")}. Actual excluded: ₹${actualExcluded.toLocaleString("en-IN")}. ₹${excess.toLocaleString("en-IN")} added back to statutory wages.`
        : "Excluded allowances are within the permitted proportion.",
    affected,
  };
}

export function sumComponents(components: SalaryComponentInput[], type: SalaryComponentInput["type"]): number {
  return components.filter((c) => c.type === type).reduce((s, c) => s + c.amount, 0);
}

export function deriveWageRuleFromComponents(components: SalaryComponentInput[]): WageRuleInput {
  const basic = components.find((c) => c.code === "basic")?.amount ?? 0;
  const da = components.find((c) => c.code === "da")?.amount ?? 0;
  const earnings = sumComponents(components, "earning");
  const excluded = earnings - basic - da;
  return {
    basic,
    dearnessAllowance: da,
    excludedComponents: Math.max(0, excluded),
    totalRemuneration: earnings,
  };
}

export function validateMinimumWage(
  grossMonthly: number,
  minimumMonthlyWage: number,
  employeeId: string,
): PayrollValidationIssue | null {
  if (minimumMonthlyWage <= 0) return null;
  if (grossMonthly < minimumMonthlyWage) {
    return {
      code: "MIN_WAGE",
      severity: "error",
      message: `Gross ₹${grossMonthly} is below applicable minimum wage ₹${minimumMonthlyWage}`,
      employeeId,
      details: { grossMonthly, minimumMonthlyWage },
    };
  }
  return null;
}

export function validateDeductionLimit(
  gross: number,
  deductions: number,
  maxPercent = 50,
  employeeId?: string,
): PayrollValidationIssue | null {
  const limit = (gross * maxPercent) / 100;
  if (deductions > limit) {
    return {
      code: "DEDUCTION_LIMIT",
      severity: "error",
      message: `Total deductions ₹${deductions.toFixed(2)} exceed ${maxPercent}% wage limit (₹${limit.toFixed(2)})`,
      employeeId,
      details: { gross, deductions, limit, maxPercent },
    };
  }
  return null;
}
