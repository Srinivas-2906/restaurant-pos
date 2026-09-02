import type { StatutoryRulePack } from "./types";

/** Default central rule pack — override per state via ComplianceJurisdiction. */
export const DEFAULT_RULE_PACK: StatutoryRulePack = {
  jurisdictionCode: "IN-CENTRAL",
  effectiveFrom: "2025-11-21",
  pfEmployeeRate: 0.12,
  pfEmployerRate: 0.12,
  pfWageCeiling: 15000,
  esiEmployeeRate: 0.0075,
  esiEmployerRate: 0.0325,
  esiWageCeiling: 21000,
  maxDeductionPercent: 50,
  excludedAllowanceCapPercent: 50,
};

export const STATE_RULE_PACKS: Record<string, StatutoryRulePack> = {
  KA: {
    ...DEFAULT_RULE_PACK,
    jurisdictionCode: "IN-KA",
    minimumMonthlyWage: 17750,
    professionalTaxSlabs: [
      { from: 0, to: 15000, amount: 0 },
      { from: 15001, to: null, amount: 200 },
    ],
  },
  AP: {
    ...DEFAULT_RULE_PACK,
    jurisdictionCode: "IN-AP",
    minimumMonthlyWage: 15000,
    professionalTaxSlabs: [
      { from: 0, to: 15000, amount: 0 },
      { from: 15001, to: 20000, amount: 150 },
      { from: 20001, to: null, amount: 200 },
    ],
  },
  TG: {
    ...DEFAULT_RULE_PACK,
    jurisdictionCode: "IN-TG",
    minimumMonthlyWage: 16000,
    professionalTaxSlabs: [{ from: 0, to: null, amount: 200 }],
  },
};

export function rulePackForState(state?: string | null): StatutoryRulePack {
  if (!state) return DEFAULT_RULE_PACK;
  const key = state.trim().toUpperCase().slice(0, 2);
  const aliases: Record<string, string> = {
    KA: "KA",
    KARNATAKA: "KA",
    AP: "AP",
    "ANDHRA PRADESH": "AP",
    TG: "TG",
    TELANGANA: "TG",
  };
  const code = aliases[state.toUpperCase()] ?? aliases[key] ?? key;
  return STATE_RULE_PACKS[code] ?? { ...DEFAULT_RULE_PACK, jurisdictionCode: `IN-${code}` };
}

export function pfEligible(headcount: number): boolean {
  return headcount >= 20;
}

export function esiEligible(headcount: number): boolean {
  return headcount >= 10;
}

export function gratuityEligible(headcount: number): boolean {
  return headcount >= 10;
}

export function poshIcRequired(headcount: number): boolean {
  return headcount >= 10;
}

export function crecheRequired(headcount: number): boolean {
  return headcount >= 50;
}

export function contractLabourRulesApply(contractWorkerCount: number): boolean {
  return contractWorkerCount >= 50;
}

export function calculateGratuityProvision(statutoryWage: number, yearsOfService: number): number {
  if (yearsOfService <= 0) return 0;
  return round2((statutoryWage * 15 * yearsOfService) / 26);
}

export function calculateStatutoryBonusMinimum(statutoryWage: number, rate = 0.0833): number {
  return round2(statutoryWage * rate);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
