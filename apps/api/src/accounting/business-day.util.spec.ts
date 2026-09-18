import { resolveMoneyPeriod, calendarDateInTimezone } from "./business-day.util";

describe("business-day.util", () => {
  it("uses Asia/Kolkata calendar date not UTC midnight", () => {
    const anchor = new Date("2026-03-15T20:00:00.000Z");
    const today = calendarDateInTimezone("Asia/Kolkata", anchor);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("resolves today period with timezone bounds", () => {
    const period = resolveMoneyPeriod("Asia/Kolkata", "today", undefined, undefined, new Date("2026-03-15T12:00:00.000Z"));
    expect(period.from).toBeInstanceOf(Date);
    expect(period.to).toBeInstanceOf(Date);
    expect(period.to.getTime()).toBeGreaterThan(period.from.getTime());
    expect(period.label).toBe("Today");
  });

  it("resolves month period from first of month", () => {
    const period = resolveMoneyPeriod("Asia/Kolkata", "month", undefined, undefined, new Date("2026-03-15T12:00:00.000Z"));
    expect(period.label).toBe("This month");
    expect(period.from.getTime()).toBeLessThan(period.to.getTime());
  });
});
