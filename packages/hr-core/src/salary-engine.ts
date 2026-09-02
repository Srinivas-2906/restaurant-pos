import type { SalaryComponentInput, StatutoryRulePack } from "./types";
import { deriveWageRuleFromComponents, validateWageRule } from "./wage-rule";

export interface PayslipCalculationInput {
  employeeId: string;
  components: SalaryComponentInput[];
  hoursWorked?: number;
  payableDays?: number;
  periodDays?: number;
  rulePack: StatutoryRulePack;
  pfApplicable?: boolean;
  esiApplicable?: boolean;
  ptApplicable?: boolean;
  additionalDeductions?: Record<string, number>;
}

export interface PayslipCalculationResult {
  employeeId: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  employerCost: number;
  statutoryWage: number;
  wageRuleExplanation: string;
  breakdown: Record<string, number>;
  lines: Array<{ code: string; name: string; type: string; amount: number }>;
}

export function calculateComponentPayslip(input: PayslipCalculationInput): PayslipCalculationResult {
  const earnings = input.components.filter((c) => c.type === "earning");
  const explicitDeductions = input.components.filter((c) => c.type === "deduction");
  const employerCosts = input.components.filter((c) => c.type === "employer_cost");

  const grossPay = round2(earnings.reduce((s, c) => s + c.amount, 0));
  const wageRule = validateWageRule(deriveWageRuleFromComponents(input.components));

  const pfBase = input.pfApplicable
    ? Math.min(wageRule.statutoryWage, input.rulePack.pfWageCeiling)
    : 0;
  const esiBase =
    input.esiApplicable && wageRule.statutoryWage <= input.rulePack.esiWageCeiling
      ? wageRule.statutoryWage
      : 0;

  const pf = input.pfApplicable ? round2(pfBase * input.rulePack.pfEmployeeRate) : 0;
  const esi = input.esiApplicable ? round2(esiBase * input.rulePack.esiEmployeeRate) : 0;
  const employerPf = input.pfApplicable ? round2(pfBase * input.rulePack.pfEmployerRate) : 0;
  const employerEsi = input.esiApplicable ? round2(esiBase * input.rulePack.esiEmployerRate) : 0;

  let pt = 0;
  if (input.ptApplicable && input.rulePack.professionalTaxSlabs) {
    pt = professionalTaxForGross(grossPay, input.rulePack.professionalTaxSlabs);
  }

  const breakdown: Record<string, number> = {};
  for (const c of earnings) breakdown[c.code] = c.amount;
  for (const c of explicitDeductions) breakdown[c.code] = c.amount;
  if (pf > 0) breakdown.pf = pf;
  if (esi > 0) breakdown.esi = esi;
  if (pt > 0) breakdown.professional_tax = pt;
  if (input.additionalDeductions) {
    for (const [k, v] of Object.entries(input.additionalDeductions)) breakdown[k] = v;
  }

  const statutoryDeductions = pf + esi + pt;
  const otherDeductions =
    explicitDeductions.reduce((s, c) => s + c.amount, 0) +
    Object.values(input.additionalDeductions ?? {}).reduce((s, v) => s + v, 0);
  const totalDeductions = round2(statutoryDeductions + otherDeductions);
  const netPay = round2(Math.max(0, grossPay - totalDeductions));
  const employerCost = round2(
    grossPay + employerPf + employerEsi + employerCosts.reduce((s, c) => s + c.amount, 0),
  );

  const lines = [
    ...earnings.map((c) => ({ code: c.code, name: c.name, type: "earning", amount: c.amount })),
    ...explicitDeductions.map((c) => ({ code: c.code, name: c.name, type: "deduction", amount: c.amount })),
    ...(pf > 0 ? [{ code: "pf", name: "EPF", type: "deduction", amount: pf }] : []),
    ...(esi > 0 ? [{ code: "esi", name: "ESIC", type: "deduction", amount: esi }] : []),
    ...(pt > 0 ? [{ code: "professional_tax", name: "Professional Tax", type: "deduction", amount: pt }] : []),
  ];

  return {
    employeeId: input.employeeId,
    grossPay,
    totalDeductions,
    netPay,
    employerCost,
    statutoryWage: wageRule.statutoryWage,
    wageRuleExplanation: wageRule.explanation,
    breakdown,
    lines,
  };
}

function professionalTaxForGross(
  gross: number,
  slabs: Array<{ from: number; to: number | null; amount: number }>,
): number {
  for (const slab of slabs) {
    const upper = slab.to ?? Infinity;
    if (gross >= slab.from && gross <= upper) return slab.amount;
  }
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
