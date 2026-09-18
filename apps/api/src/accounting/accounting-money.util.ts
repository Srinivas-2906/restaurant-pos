import { Prisma } from "@kaana/database";

export type MoneyInput = number | string | Prisma.Decimal;

export function money(value: MoneyInput): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

export function roundMoney(value: MoneyInput): Prisma.Decimal {
  return money(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function sumMoney(values: MoneyInput[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(money(v)), new Prisma.Decimal(0));
}

export function assertBalanced(
  lines: Array<{ debit?: MoneyInput; credit?: MoneyInput }>,
  tolerance = 0,
): { debitTotal: Prisma.Decimal; creditTotal: Prisma.Decimal } {
  const debitTotal = roundMoney(sumMoney(lines.map((l) => l.debit ?? 0)));
  const creditTotal = roundMoney(sumMoney(lines.map((l) => l.credit ?? 0)));
  const diff = debitTotal.minus(creditTotal).abs();
  if (diff.greaterThan(tolerance)) {
    throw new Error(`Journal not balanced: debits=${debitTotal} credits=${creditTotal}`);
  }
  return { debitTotal, creditTotal };
}

export function toNumber(d: Prisma.Decimal): number {
  return Number(d.toFixed(2));
}
