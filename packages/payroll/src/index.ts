export interface PayslipInput {
  userId: string;
  grossPay: number;
  hoursWorked?: number;
  deductions?: number;
}

export interface PayslipResult {
  userId: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  breakdown: Record<string, number>;
}

export function calculatePayslip(input: PayslipInput): PayslipResult {
  const pf = input.grossPay * 0.12;
  const esi = input.grossPay * 0.0075;
  const deductions = input.deductions ?? pf + esi;
  const netPay = Math.round((input.grossPay - deductions) * 100) / 100;
  return {
    userId: input.userId,
    grossPay: input.grossPay,
    deductions: Math.round(deductions * 100) / 100,
    netPay,
    breakdown: { pf: Math.round(pf * 100) / 100, esi: Math.round(esi * 100) / 100 },
  };
}

export function grossFromAttendance(hoursWorked: number, hourlyRate: number): number {
  return Math.round(hoursWorked * hourlyRate * 100) / 100;
}

export function grossFromMonthly(monthlySalary: number, daysWorked: number, daysInMonth = 30): number {
  return Math.round((monthlySalary / daysInMonth) * daysWorked * 100) / 100;
}
