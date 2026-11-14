/**
 * Money: Accounts, the Expenses, Incomes and Transfers between them, and what
 * a month adds up to. Amounts are whole numbers in the currency's smallest
 * unit (pesos, or cents of a dollar), so nothing is ever rounded.
 */

export const CURRENCIES = ["COP", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MOVEMENT_KINDS = ["expense", "income", "transfer"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export const MAX_MONEY_NAME = 60;
export const MAX_MOVEMENT_NOTE = 200;
/** Far above anything real, and well inside a safe integer. */
export const MAX_AMOUNT = 1_000_000_000_000;

/** Digits after the decimal point: pesos have none (Q15). */
const SCALE: Record<Currency, number> = { COP: 0, USD: 2 };

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

/**
 * What Ivan typed, in the smallest unit, or null if it isn't an amount above 0.
 * Pesos take any dots or commas as grouping ("1.450.000"). Dollars read a
 * last separator followed by one or two digits as the decimal point, whichever
 * it is ("12,50" and "12.50" are both 1250 cents).
 */
export function parseAmount(text: string, currency: Currency): number | null {
  const clean = text.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(clean) || clean.includes("-")) return null;
  let units: number;
  if (SCALE[currency] === 0) {
    units = Number(clean.replace(/[.,]/g, ""));
  } else {
    const decimal = /[.,](\d{1,2})$/.exec(clean);
    const whole = (decimal ? clean.slice(0, decimal.index) : clean).replace(/[.,]/g, "");
    const cents = decimal ? decimal[1].padEnd(2, "0") : "00";
    units = Number(whole || "0") * 100 + Number(cents);
  }
  if (!Number.isSafeInteger(units) || units <= 0 || units > MAX_AMOUNT) return null;
  return units;
}

/** Like parseAmount, but 0 and a leading minus are fine: an opening balance can be anything. */
export function parseBalance(text: string, currency: Currency): number | null {
  const trimmed = text.trim();
  if (trimmed === "" || /^[$\s]*0+([.,]0*)?$/.test(trimmed)) return 0;
  const negative = trimmed.startsWith("-") || trimmed.startsWith("−");
  const units = parseAmount(trimmed.replace(/^[-−]/, ""), currency);
  if (units === null) return null;
  return negative ? -units : units;
}

/** "$1.450.000" for pesos, "US$1.234,50" for dollars; a minus sign in front when below 0. */
export function formatAmount(units: number, currency: Currency): string {
  const sign = units < 0 ? "−" : "";
  const abs = Math.abs(units);
  const scale = SCALE[currency];
  const whole = Math.floor(abs / 10 ** scale);
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const prefix = currency === "COP" ? "$" : "US$";
  if (scale === 0) return `${sign}${prefix}${grouped}`;
  const fraction = String(abs % 10 ** scale).padStart(scale, "0");
  return `${sign}${prefix}${grouped},${fraction}`;
}

/**
 * What an amount field keeps of what Ivan typed or pasted: digits, dots and
 * commas, and for a balance, which can be below 0, a minus in front.
 */
export function amountTyping(text: string, { balance = false } = {}): string {
  const negative = balance && /^\s*[-−]/.test(text);
  const kept = text.replace(/[^\d.,]/g, "");
  return negative ? `-${kept}` : kept;
}

/** The amount as Ivan would type it back into the field: no symbol, no grouping. */
export function amountInput(units: number, currency: Currency): string {
  const scale = SCALE[currency];
  if (scale === 0) return String(units);
  const sign = units < 0 ? "-" : "";
  const abs = Math.abs(units);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export type AccountRef = { id: string; currency: Currency; savings: boolean; openingBalance: number };

/**
 * A movement as the books see it. `accountId` is where the money leaves
 * (Expense, Transfer) or arrives (Income); a Transfer also has where it
 * arrives and how much arrived there, in that Account's currency.
 */
export type MovementRef = {
  kind: MovementKind;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  toAmount: number | null;
};

/** An Adjustment: the difference between what an Account held for real and what Ivan OS said. */
export type AdjustmentRef = { accountId: string; delta: number };

/** Each Account's balance: its opening balance, everything that came in or went out since, and its Adjustments. */
export function balances(
  accounts: AccountRef[],
  movements: MovementRef[],
  adjustments: AdjustmentRef[] = [],
): Map<string, number> {
  const result = new Map(accounts.map((a) => [a.id, a.openingBalance]));
  const add = (id: string | null, units: number) => {
    if (id !== null && result.has(id)) result.set(id, result.get(id)! + units);
  };
  for (const m of movements) {
    if (m.kind === "income") add(m.accountId, m.amount);
    else add(m.accountId, -m.amount);
    if (m.kind === "transfer") add(m.toAccountId, m.toAmount ?? 0);
  }
  for (const a of adjustments) add(a.accountId, a.delta);
  return result;
}

export type CurrencySummary = {
  currency: Currency;
  income: number;
  expenses: number;
  /** What went into Savings Accounts minus what came out of them. */
  saved: number;
  /** Saved as a share of Income (0.3 is 30 %), or null with no Income. */
  savedShare: number | null;
};

/**
 * What a month adds up to, one line per currency, never converted (Q9).
 * Pesos always show once there is a peso Account; dollars only when they moved.
 * Money moving between two Savings Accounts was saved already and doesn't count.
 */
export function monthSummary(accounts: AccountRef[], movements: MovementRef[]): CurrencySummary[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const lines = new Map<Currency, CurrencySummary>();
  const line = (currency: Currency) => {
    let found = lines.get(currency);
    if (!found) {
      found = { currency, income: 0, expenses: 0, saved: 0, savedShare: null };
      lines.set(currency, found);
    }
    return found;
  };
  if (accounts.some((a) => a.currency === "COP")) line("COP");

  for (const m of movements) {
    const from = byId.get(m.accountId);
    if (!from) continue;
    if (m.kind === "income") {
      line(from.currency).income += m.amount;
      if (from.savings) line(from.currency).saved += m.amount;
    } else if (m.kind === "expense") {
      line(from.currency).expenses += m.amount;
      if (from.savings) line(from.currency).saved -= m.amount;
    } else {
      const to = m.toAccountId ? byId.get(m.toAccountId) : undefined;
      // Both currencies moved, so both show, even when nothing counts as saved.
      line(from.currency);
      if (to) line(to.currency);
      if (!to || from.savings === to.savings) continue;
      if (to.savings) line(to.currency).saved += m.toAmount ?? 0;
      else line(from.currency).saved -= m.amount;
    }
  }

  return [...lines.values()]
    .map((l) => ({ ...l, savedShare: l.income > 0 ? l.saved / l.income : null }))
    .sort((a, b) => CURRENCIES.indexOf(a.currency) - CURRENCIES.indexOf(b.currency));
}

/** "30 %" of Income saved; one decimal only below 10 %. */
export function shareLabel(share: number): string {
  const pct = share * 100;
  const shown = Math.abs(pct) < 10 ? Math.round(pct * 10) / 10 : Math.round(pct);
  return `${shown}%`;
}

/** `categoryId` is null for Income recorded before Income had Categories. */
export type CategoryTotal = { categoryId: string | null; currency: Currency; total: number; count: number };

/**
 * Where the month's Expenses went, or where its Income came from: per Category
 * and currency, pesos first, the most money first.
 */
export function categoryTotals(
  accounts: AccountRef[],
  movements: (MovementRef & { categoryId: string | null })[],
  kind: "expense" | "income" = "expense",
): CategoryTotal[] {
  const currencyOf = new Map(accounts.map((a) => [a.id, a.currency]));
  const totals = new Map<string, CategoryTotal>();
  for (const e of movements) {
    const currency = currencyOf.get(e.accountId);
    if (e.kind !== kind || !currency) continue;
    if (kind === "expense" && !e.categoryId) continue;
    const key = `${currency}:${e.categoryId ?? ""}`;
    const found = totals.get(key) ?? { categoryId: e.categoryId, currency, total: 0, count: 0 };
    found.total += e.amount;
    found.count += 1;
    totals.set(key, found);
  }
  return [...totals.values()].sort(
    (a, b) => CURRENCIES.indexOf(a.currency) - CURRENCIES.indexOf(b.currency) || b.total - a.total,
  );
}

export type MovementCheck =
  | { kind: "expense" | "income"; categoryId: string | null }
  | { kind: "transfer"; from: Currency; to: Currency | null; sameAccount: boolean; toAmount: number | null };

/** Why a movement can't be saved as it is, or null when it can. */
export function movementProblem(m: MovementCheck): string | null {
  if (m.kind !== "transfer" && !m.categoryId) return "Pick a Category.";
  if (m.kind === "transfer") {
    if (!m.to) return "Pick where the money goes.";
    if (m.sameAccount) return "A Transfer goes between two different Accounts.";
    if (m.from !== m.to && m.toAmount === null) return `Say how much arrived, in ${m.to}.`;
  }
  return null;
}

/** "Food" and "food " are the same Category. */
export function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

// ─── The page ────────────────────────────────────────────────────────────────

/** The tabs under the month summary (Ronda 61); it opens on Movements. */
export const MONEY_TABS = ["movements", "recurrings", "debts", "accounts", "categories"] as const;
export type MoneyTab = (typeof MONEY_TABS)[number];

export function moneyTab(value: string | string[] | null | undefined): MoneyTab {
  return (MONEY_TABS as readonly string[]).includes(value as string) ? (value as MoneyTab) : "movements";
}

/** Where each slice of a pie starts and ends, as parts of the whole turn (0 to 1). */
export function pieSlices(values: number[]): { start: number; end: number }[] {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0);
  let sum = 0;
  return values.map((v) => {
    const start = total > 0 ? sum / total : 0;
    sum += Math.max(0, v);
    return { start, end: total > 0 ? sum / total : 0 };
  });
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export const MAX_MOVEMENT_CAMPAIGNS = 10;

/** Only Expenses and Incomes serve Campaigns; a Transfer stays mine (Q7). */
export function servesCampaigns(kind: MovementKind): boolean {
  return kind !== "transfer";
}

/** What a Campaign has cost and brought in, in pesos: a record, not a budget (Q9, Q11). */
export function campaignMoney(movements: { kind: MovementKind; amount: number; currency: Currency }[]): {
  spent: number;
  cameIn: number;
} {
  let spent = 0;
  let cameIn = 0;
  for (const m of movements) {
    if (m.currency !== "COP") continue;
    if (m.kind === "expense") spent += m.amount;
    else if (m.kind === "income") cameIn += m.amount;
  }
  return { spent, cameIn };
}
