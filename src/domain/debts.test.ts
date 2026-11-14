import { describe, expect, it } from "vitest";
import { debtLeft, debtState, debtTotals, openingKind, paymentKind, paymentProblem, reminderTitle } from "./debts";

describe("Debts", () => {
  it("are paid in parts, and what is left never goes below 0", () => {
    expect(debtLeft(500_000, [])).toBe(500_000);
    expect(debtLeft(500_000, [{ amount: 200_000 }, { amount: 100_000 }])).toBe(200_000);
    expect(debtLeft(500_000, [{ amount: 600_000 }])).toBe(0);
  });

  it("are done at 0 or when closed by hand", () => {
    expect(debtState({ amount: 100, closedAt: null }, [{ amount: 40 }])).toBe("open");
    expect(debtState({ amount: 100, closedAt: null }, [{ amount: 100 }])).toBe("paid");
    expect(debtState({ amount: 100, closedAt: new Date() }, [{ amount: 40 }])).toBe("closed");
  });

  it("take no more than what is left", () => {
    expect(paymentProblem(200_000, 300_000)).toBeNull();
    expect(paymentProblem(300_000, 300_000)).toBeNull();
    expect(paymentProblem(300_001, 300_000)).toBe("Only $300.000 is left.");
    expect(paymentProblem(0, 300_000)).toMatch(/above 0/);
    expect(paymentProblem(null, 300_000)).toMatch(/above 0/);
  });

  it("are paid as Expenses and collected as Incomes; lending starts the other way", () => {
    expect(paymentKind("owe")).toBe("expense");
    expect(paymentKind("owed")).toBe("income");
    expect(openingKind("owe")).toBe("income");
    expect(openingKind("owed")).toBe("expense");
  });

  it("remind Ivan in words", () => {
    expect(reminderTitle("owe", "Universidad", 500_000)).toBe("Pay Universidad $500.000");
    expect(reminderTitle("owed", "Carlos UIF", 150_000)).toBe("Collect $150.000 from Carlos UIF");
  });

  it("add up what is still owed each way, over open ones only", () => {
    expect(
      debtTotals([
        { side: "owe", left: 500_000, state: "open" },
        { side: "owe", left: 100_000, state: "closed" },
        { side: "owed", left: 150_000, state: "open" },
        { side: "owed", left: 0, state: "paid" },
      ]),
    ).toEqual({ owe: 500_000, owed: 150_000 });
  });
});
