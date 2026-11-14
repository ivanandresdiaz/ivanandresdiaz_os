/**
 * Debts (Ronda 62): money Ivan owes (I owe) or is owed (Owed to me), once, in
 * pesos. It is paid or collected in parts; what is left is the amount minus
 * what was paid, and it is done at 0 or when closed by hand.
 */
import { formatAmount } from "./money";

export const DEBT_SIDES = ["owe", "owed"] as const;
export type DebtSide = (typeof DEBT_SIDES)[number];

export const MAX_DEBT_WHO = 80;

/** Paying what I owe is an Expense; collecting what I'm owed is an Income (Q9, Q11). */
export function paymentKind(side: DebtSide): "expense" | "income" {
  return side === "owe" ? "expense" : "income";
}

/** The money that starts it: lent to me comes in as Income, lent by me goes out as an Expense (Q10, Q12). */
export function openingKind(side: DebtSide): "expense" | "income" {
  return side === "owe" ? "income" : "expense";
}

export function debtLeft(amount: number, payments: { amount: number }[]): number {
  return Math.max(0, amount - payments.reduce((sum, p) => sum + p.amount, 0));
}

/** Open, paid off (its payments reached the amount) or closed by hand. */
export type DebtState = "open" | "paid" | "closed";

export function debtState(debt: { amount: number; closedAt: Date | string | null }, payments: { amount: number }[]): DebtState {
  if (debtLeft(debt.amount, payments) === 0) return "paid";
  return debt.closedAt ? "closed" : "open";
}

/** Why a payment can't be taken, or null when it can. */
export function paymentProblem(amount: number | null, left: number): string | null {
  if (amount === null || amount <= 0) return "Type an amount above 0.";
  if (amount > left) return `Only ${formatAmount(left, "COP")} is left.`;
  return null;
}

/** The Secondary Task that reminds Ivan (Q6), e.g. "Pay Universidad $500.000". */
export function reminderTitle(side: DebtSide, who: string, left: number): string {
  const amount = formatAmount(left, "COP");
  return side === "owe" ? `Pay ${who} ${amount}` : `Collect ${amount} from ${who}`;
}

/** What is still owed each way, over the open Debts only (Q8). */
export function debtTotals(debts: { side: DebtSide; left: number; state: DebtState }[]): { owe: number; owed: number } {
  const totals = { owe: 0, owed: 0 };
  for (const d of debts) if (d.state === "open") totals[d.side] += d.left;
  return totals;
}
