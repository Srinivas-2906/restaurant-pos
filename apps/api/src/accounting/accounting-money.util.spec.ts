import { assertBalanced, roundMoney } from "./accounting-money.util";

describe("accounting-money.util", () => {
  it("accepts exactly balanced journals", () => {
    expect(() =>
      assertBalanced([
        { debit: 100, credit: 0 },
        { credit: 100, debit: 0 },
      ]),
    ).not.toThrow();
  });

  it("rejects 0.01 imbalance", () => {
    expect(() =>
      assertBalanced([
        { debit: 100, credit: 0 },
        { credit: 99.99, debit: 0 },
      ]),
    ).toThrow(/not balanced/i);
  });

  it("rounds to 2 decimal INR places", () => {
    expect(Number(roundMoney(10.005))).toBe(10.01);
    expect(Number(roundMoney(10.004))).toBe(10);
  });
});
