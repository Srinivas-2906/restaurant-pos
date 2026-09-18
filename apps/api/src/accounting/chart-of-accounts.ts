import type { GlAccountType } from "@kaana/database";

export type CoaEntry = { code: string; name: string; type: GlAccountType };

/** Deterministic Indian restaurant chart of accounts (organization-scoped). */
export const CHART_OF_ACCOUNTS: CoaEntry[] = [
  { code: "1000", name: "Cash on Hand", type: "asset" },
  { code: "1010", name: "Bank", type: "asset" },
  { code: "1020", name: "UPI Clearing", type: "asset" },
  { code: "1030", name: "Card Clearing", type: "asset" },
  { code: "1100", name: "Accounts Receivable", type: "asset" },
  { code: "1200", name: "Inventory Asset", type: "asset" },
  { code: "1210", name: "Inventory In Transit", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "GRNI", type: "liability" },
  { code: "2200", name: "Output CGST Payable", type: "liability" },
  { code: "2210", name: "Output SGST Payable", type: "liability" },
  { code: "2220", name: "Output IGST Payable", type: "liability" },
  { code: "2300", name: "Input CGST Receivable", type: "asset" },
  { code: "2310", name: "Input SGST Receivable", type: "asset" },
  { code: "3000", name: "Owner Capital", type: "equity" },
  { code: "3100", name: "Owner Drawings", type: "equity" },
  { code: "3200", name: "Opening Balance Equity", type: "equity" },
  { code: "4000", name: "Restaurant Sales Revenue", type: "revenue" },
  { code: "4900", name: "Inventory Adjustment Gain", type: "revenue" },
  { code: "5000", name: "Cost of Goods Sold", type: "expense" },
  { code: "5100", name: "Inventory Wastage Expense", type: "expense" },
  { code: "5200", name: "Inventory Adjustment Loss", type: "expense" },
  { code: "5300", name: "Operating Expenses", type: "expense" },
];

export const AC = {
  CASH: "1000",
  BANK: "1010",
  UPI: "1020",
  CARD: "1030",
  AR: "1100",
  INVENTORY: "1200",
  IN_TRANSIT: "1210",
  AP: "2000",
  GRNI: "2100",
  OUTPUT_CGST: "2200",
  OUTPUT_SGST: "2210",
  OUTPUT_IGST: "2220",
  INPUT_CGST: "2300",
  INPUT_SGST: "2310",
  OWNER_CAPITAL: "3000",
  OWNER_DRAWINGS: "3100",
  OPENING_EQUITY: "3200",
  SALES: "4000",
  ADJ_GAIN: "4900",
  COGS: "5000",
  WASTAGE: "5100",
  ADJ_LOSS: "5200",
  OPEX: "5300",
} as const;

export function paymentAssetAccount(method: string): string {
  switch (method) {
    case "upi":
    case "wallet":
      return AC.UPI;
    case "card":
      return AC.CARD;
    case "bank":
      return AC.BANK;
    default:
      return AC.CASH;
  }
}
