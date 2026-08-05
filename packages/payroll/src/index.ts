export interface PayslipInput {
  userId: string;
  grossPay: number;
  hoursWorked?: number;
  deductions?: number;
  pfRate?: number;
  esiRate?: number;
}

export interface PayslipResult {
  userId: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  breakdown: Record<string, number>;
}

export interface PayableDaysInput {
  periodStart: Date;
  periodEnd: Date;
  workedDays: number;
  weeklyOffDays: number;
  holidays: number;
  paidLeaveDays: number;
}

export function calculatePayableDays(input: PayableDaysInput): number {
  const totalCalendar =
    Math.floor((input.periodEnd.getTime() - input.periodStart.getTime()) / 86_400_000) + 1;
  const nonPayable = input.weeklyOffDays + input.holidays;
  const payable = input.workedDays + input.paidLeaveDays;
  return Math.min(totalCalendar - nonPayable, Math.max(payable, 0));
}

export function calculatePayslip(input: PayslipInput): PayslipResult {
  const pfRate = input.pfRate ?? 0.12;
  const esiRate = input.esiRate ?? 0.0075;
  const pf = input.grossPay * pfRate;
  const esi = input.grossPay * esiRate;
  const deductions = input.deductions ?? pf + esi;
  const netPay = Math.round((input.grossPay - deductions) * 100) / 100;
  return {
    userId: input.userId,
    grossPay: input.grossPay,
    deductions: Math.round(deductions * 100) / 100,
    netPay,
    breakdown: {
      pf: Math.round(pf * 100) / 100,
      esi: Math.round(esi * 100) / 100,
    },
  };
}

export function grossFromAttendance(hoursWorked: number, hourlyRate: number): number {
  return Math.round(hoursWorked * hourlyRate * 100) / 100;
}

export function grossFromMonthly(
  monthlySalary: number,
  payableDays: number,
  daysInPeriod = 30,
): number {
  if (daysInPeriod <= 0) return 0;
  return Math.round((monthlySalary / daysInPeriod) * payableDays * 100) / 100;
}

export function daysInPeriod(periodStart: Date, periodEnd: Date): number {
  return Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86_400_000) + 1;
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  return `${rupees.toLocaleString("en-IN")} Rupees${paise > 0 ? ` and ${paise} Paise` : ""} Only`;
}
