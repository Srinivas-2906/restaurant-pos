import type { ComplianceThreshold } from "./types";
import {
  contractLabourRulesApply,
  crecheRequired,
  esiEligible,
  gratuityEligible,
  pfEligible,
  poshIcRequired,
} from "./statutory";

export interface ComplianceCalendarItem {
  code: string;
  title: string;
  frequency: "monthly" | "quarterly" | "half_yearly" | "annual";
  dueDayOfMonth?: number;
  dueMonth?: number;
  description: string;
}

export const COMPLIANCE_CALENDAR: ComplianceCalendarItem[] = [
  { code: "WAGE_PAYMENT", title: "Monthly wage payment", frequency: "monthly", dueDayOfMonth: 7, description: "Before 7th of succeeding month" },
  { code: "PF_CONTRIBUTION", title: "PF contribution deposit", frequency: "monthly", dueDayOfMonth: 15, description: "EPF challan and ECR" },
  { code: "ESI_CONTRIBUTION", title: "ESI contribution deposit", frequency: "monthly", dueDayOfMonth: 15, description: "ESIC challan" },
  { code: "PT_DEPOSIT", title: "Professional Tax deposit", frequency: "monthly", dueDayOfMonth: 20, description: "State-specific PT payment" },
  { code: "TDS_DEPOSIT", title: "TDS deposit", frequency: "monthly", dueDayOfMonth: 7, description: "Salary TDS under Income Tax Act" },
  { code: "TDS_RETURN", title: "TDS quarterly return", frequency: "quarterly", description: "Form 24Q / revised terminology from FY 2026-27" },
  { code: "PT_RETURN", title: "Professional Tax return", frequency: "half_yearly", description: "Where applicable by state" },
  { code: "POSH_ANNUAL", title: "POSH annual report", frequency: "annual", description: "Internal Committee annual reporting" },
  { code: "UALR", title: "Unified Annual Labour Return", frequency: "annual", description: "Central annual labour return" },
  { code: "FOOD_HANDLER_MEDICAL", title: "Food-handler medical review", frequency: "annual", description: "FSSAI annual medical examination cycle" },
];

export function computeThresholds(input: {
  employeeCount: number;
  contractWorkerCount: number;
  appointmentLettersIssued: number;
  foodHandlerCompliancePct: number;
}): ComplianceThreshold[] {
  const { employeeCount, contractWorkerCount } = input;
  return [
    { code: "ALL", label: "Appointment letters", threshold: employeeCount, current: input.appointmentLettersIssued, met: input.appointmentLettersIssued >= employeeCount, obligation: "Every employee" },
    { code: "ESI", label: "ESIC applicability", threshold: 10, current: employeeCount, met: !esiEligible(employeeCount) || true, obligation: "10+ employees" },
    { code: "GRATUITY", label: "Gratuity applicability", threshold: 10, current: employeeCount, met: !gratuityEligible(employeeCount) || true, obligation: "10+ employees" },
    { code: "POSH", label: "POSH Internal Committee", threshold: 10, current: employeeCount, met: !poshIcRequired(employeeCount) || true, obligation: "10+ employees" },
    { code: "EPF", label: "EPF applicability", threshold: 20, current: employeeCount, met: !pfEligible(employeeCount) || true, obligation: "20+ employees" },
    { code: "CRECHE", label: "Creche facility", threshold: 50, current: employeeCount, met: !crecheRequired(employeeCount) || true, obligation: "50+ employees" },
    { code: "CONTRACT_LABOUR", label: "Contract labour provisions", threshold: 50, current: contractWorkerCount, met: !contractLabourRulesApply(contractWorkerCount) || true, obligation: "50 contract workers" },
    { code: "FOOD_HANDLER", label: "Food-handler medical compliance", threshold: 100, current: Math.round(input.foodHandlerCompliancePct), met: input.foodHandlerCompliancePct >= 100, obligation: "Valid medical fitness records" },
  ];
}

export function dueDateForCalendarItem(item: ComplianceCalendarItem, ref: Date): Date {
  const d = new Date(ref);
  if (item.frequency === "monthly" && item.dueDayOfMonth) {
    d.setMonth(d.getMonth() + 1);
    d.setDate(item.dueDayOfMonth);
    return d;
  }
  if (item.frequency === "annual") {
    d.setFullYear(d.getFullYear() + 1);
    d.setMonth(item.dueMonth ?? 0);
    d.setDate(item.dueDayOfMonth ?? 31);
    return d;
  }
  return d;
}
