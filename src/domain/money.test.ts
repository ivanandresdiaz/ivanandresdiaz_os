import { describe, expect, it } from "vitest";
import {
  amountInput,
  amountTyping,
  balances,
  categoryTotals,
  formatAmount,
  monthSummary,
  movementProblem,
  parseAmount,
  parseBalance,
  sameName,
  shareLabel,
  type AccountRef,
  type MovementRef,
} from "./money";

describe("Amounts", () => {
  it("reads pesos with or without grouping or a sign", () => {
    expect(parseAmount("45000", "COP")).toBe(45000);
    expect(parseAmount("1.450.000", "COP")).toBe(1_450_000);
    expect(parseAmount("$ 1,450,000", "COP")).toBe(1_450_000);
  });

  it("reads dollars with either decimal point", () => {
    expect(parseAmount("100", "USD")).toBe(10000);
    expect(parseAmount("12.5", "USD")).toBe(1250);
    expect(parseAmount("12,50", "USD")).toBe(1250);
    expect(parseAmount("1,234.56", "USD")).toBe(123456);
    expect(parseAmount("1.234,56", "USD")).toBe(123456);
    expect(parseAmount("1.000", "USD")).toBe(100000);
  });

  it("only takes amounts above 0", () => {
    expect(parseAmount("", "COP")).toBeNull();
    expect(parseAmount("0", "COP")).toBeNull();
    expect(parseAmount("-5000", "COP")).toBeNull();
    expect(parseAmount("abc", "USD")).toBeNull();
    expect(parseAmount("99999999999999", "COP")).toBeNull();
  });

  it("lets an opening balance be 0 or below", () => {
    expect(parseBalance("", "COP")).toBe(0);
    expect(parseBalance("0", "USD")).toBe(0);
    expect(parseBalance("-20.000", "COP")).toBe(-20000);
    expect(parseBalance("250000", "COP")).toBe(250000);
    expect(parseBalance("x", "COP")).toBeNull();
  });

  it("shows pesos without cents and dollars with them", () => {
    expect(formatAmount(1_450_000, "COP")).toBe("$1.450.000");
    expect(formatAmount(500, "COP")).toBe("$500");
    expect(formatAmount(-600_000, "COP")).toBe("−$600.000");
    expect(formatAmount(123456, "USD")).toBe("US$1.234,56");
    expect(formatAmount(5, "USD")).toBe("US$0,05");
  });

  it("keeps only digits, dots and commas as Ivan types", () => {
    expect(amountTyping("45abc000")).toBe("45000");
    expect(amountTyping("$ 1.450.000")).toBe("1.450.000");
    expect(amountTyping("12,50 usd")).toBe("12,50");
    expect(amountTyping("-5000")).toBe("5000");
  });

  it("lets a balance start with a minus", () => {
    expect(amountTyping("-20.000", { balance: true })).toBe("-20.000");
    expect(amountTyping("−20x", { balance: true })).toBe("-20");
    expect(amountTyping("-", { balance: true })).toBe("-");
    expect(amountTyping("20-", { balance: true })).toBe("20");
  });

  it("gives the field back what it can read again", () => {
    expect(amountInput(45000, "COP")).toBe("45000");
    expect(amountInput(1250, "USD")).toBe("12.50");
    expect(parseAmount(amountInput(1250, "USD"), "USD")).toBe(1250);
  });
});

const bank: AccountRef = { id: "bank", currency: "COP", savings: false, openingBalance: 1_000_000 };
const cash: AccountRef = { id: "cash", currency: "COP", savings: false, openingBalance: 0 };
const savings: AccountRef = { id: "savings", currency: "COP", savings: true, openingBalance: 2_000_000 };
const zulu: AccountRef = { id: "zulu", currency: "USD", savings: false, openingBalance: 0 };
const accounts = [bank, cash, savings, zulu];

const expense = (amount: number, accountId = "bank", categoryId = "food") => ({
  kind: "expense" as const,
  amount,
  accountId,
  toAccountId: null,
  toAmount: null,
  categoryId,
});
const income = (amount: number, accountId = "bank"): MovementRef => ({
  kind: "income",
  amount,
  accountId,
  toAccountId: null,
  toAmount: null,
});
const transfer = (amount: number, from: string, to: string, toAmount = amount): MovementRef => ({
  kind: "transfer",
  amount,
  accountId: from,
  toAccountId: to,
  toAmount,
});

describe("Balances", () => {
  it("start from the opening balance and follow every movement", () => {
    const result = balances(accounts, [
      income(1_450_000),
      expense(45_000),
      transfer(200_000, "bank", "cash"),
      expense(20_000, "cash"),
      transfer(1_000_000, "bank", "savings"),
      transfer(400_000, "bank", "zulu", 10_000),
    ]);
    expect(result.get("bank")).toBe(1_000_000 + 1_450_000 - 45_000 - 200_000 - 1_000_000 - 400_000);
    expect(result.get("cash")).toBe(180_000);
    expect(result.get("savings")).toBe(3_000_000);
    expect(result.get("zulu")).toBe(10_000);
  });

  it("take Adjustments, which can go either way", () => {
    const result = balances(accounts, [transfer(400_000, "bank", "zulu", 10_000)], [
      { accountId: "zulu", delta: -800 },
      { accountId: "cash", delta: -20_000 },
    ]);
    expect(result.get("zulu")).toBe(9_200);
    expect(result.get("cash")).toBe(-20_000);
  });
});

describe("The month", () => {
  it("adds Income, Expenses and what was saved, and its share of Income", () => {
    const [cop] = monthSummary(accounts, [
      income(1_450_000),
      income(1_450_000),
      expense(600_000),
      transfer(1_000_000, "bank", "savings"),
      transfer(200_000, "bank", "cash"),
    ]);
    expect(cop).toEqual({ currency: "COP", income: 2_900_000, expenses: 600_000, saved: 1_000_000, savedShare: 1 / 2.9 });
  });

  it("counts what comes out of savings against what was saved", () => {
    const [cop] = monthSummary(accounts, [
      income(1_000_000),
      transfer(500_000, "bank", "savings"),
      transfer(100_000, "savings", "bank"),
      expense(50_000, "savings"),
    ]);
    expect(cop.saved).toBe(350_000);
  });

  it("keeps pesos and dollars apart, without converting", () => {
    const lines = monthSummary(accounts, [transfer(400_000, "bank", "zulu", 10_000), expense(500, "zulu")]);
    expect(lines.map((l) => l.currency)).toEqual(["COP", "USD"]);
    expect(lines[1]).toMatchObject({ expenses: 500, income: 0, savedShare: null });
  });

  it("shows dollars when a Transfer only brought them in", () => {
    const lines = monthSummary(accounts, [transfer(400_000, "bank", "zulu", 10_000)]);
    expect(lines).toEqual([
      { currency: "COP", income: 0, expenses: 0, saved: 0, savedShare: null },
      { currency: "USD", income: 0, expenses: 0, saved: 0, savedShare: null },
    ]);
  });

  it("shows pesos even in an empty month, and dollars only when they moved", () => {
    expect(monthSummary(accounts, [])).toEqual([
      { currency: "COP", income: 0, expenses: 0, saved: 0, savedShare: null },
    ]);
  });

  it("doesn't count money moving between two Savings Accounts", () => {
    const usdSavings: AccountRef = { id: "usd-savings", currency: "USD", savings: true, openingBalance: 0 };
    const lines = monthSummary([...accounts, usdSavings], [transfer(400_000, "savings", "usd-savings", 10_000)]);
    expect(lines.every((l) => l.saved === 0)).toBe(true);
  });

  it("says the share as a percentage", () => {
    expect(shareLabel(1 / 2.9)).toBe("34%");
    expect(shareLabel(0.3)).toBe("30%");
    expect(shareLabel(0.034)).toBe("3.4%");
    expect(shareLabel(-0.05)).toBe("-5%");
  });

  it("sorts where the money went, most first, pesos before dollars", () => {
    const totals = categoryTotals(accounts, [
      expense(45_000, "bank", "food"),
      expense(600_000, "bank", "home"),
      expense(30_000, "cash", "food"),
      expense(500, "zulu", "fees"),
    ]);
    expect(totals).toEqual([
      { categoryId: "home", currency: "COP", total: 600_000, count: 1 },
      { categoryId: "food", currency: "COP", total: 75_000, count: 2 },
      { categoryId: "fees", currency: "USD", total: 500, count: 1 },
    ]);
  });
});

describe("What a movement needs", () => {
  it("an Expense needs its Category", () => {
    expect(movementProblem({ kind: "expense", categoryId: null })).toBe("Pick a Category.");
    expect(movementProblem({ kind: "expense", categoryId: "food" })).toBeNull();
    expect(movementProblem({ kind: "income" })).toBeNull();
  });

  it("a Transfer needs two Accounts, and what arrived when the currency changes", () => {
    const base = { kind: "transfer" as const, from: "COP" as const, sameAccount: false, toAmount: null };
    expect(movementProblem({ ...base, to: null })).toBe("Pick where the money goes.");
    expect(movementProblem({ ...base, to: "COP", sameAccount: true })).toMatch(/two different/);
    expect(movementProblem({ ...base, to: "USD" })).toBe("Say how much arrived, in USD.");
    expect(movementProblem({ ...base, to: "USD", toAmount: 10_000 })).toBeNull();
    expect(movementProblem({ ...base, to: "COP" })).toBeNull();
  });

  it("names are the same regardless of case and spaces", () => {
    expect(sameName("Food", " food ")).toBe(true);
    expect(sameName("Food", "Home")).toBe(false);
  });
});
