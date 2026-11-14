import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { addMonths, type IsoDate, type IsoMonth } from "@/domain/dates";
import {
  balances,
  categoryTotals,
  monthSummary,
  type AccountRef,
  type Currency,
  type CurrencySummary,
  type MovementKind,
} from "@/domain/money";
import {
  nextOccurrence,
  occurrencesFor,
  resolutionKey,
  scheduleLabel,
  type OccurrenceState,
  type Resolutions,
} from "@/domain/recurring";

export type AccountView = AccountRef & {
  name: string;
  balance: number;
  /** What its Adjustments added up to in the month shown, when it had any. */
  monthAdjusted: number | null;
  /** Movements, Adjustments or Recurrings point at it, so it can't be deleted. */
  inUse: boolean;
};
export type CategoryView = { id: string; name: string; expenses: number; recurrings: number };

/** What a movement and a Recurring share: what moves, from where, to where. */
type Flow = {
  kind: MovementKind;
  amount: number;
  currency: Currency;
  accountId: string;
  accountName: string;
  toAccountId: string | null;
  toAccountName: string | null;
  toAmount: number | null;
  toCurrency: Currency | null;
  categoryId: string | null;
  categoryName: string | null;
};
export type MovementView = Flow & { id: string; date: IsoDate; note: string | null };
export type RecurringView = Flow & {
  id: string;
  name: string;
  firstDate: IsoDate;
  everyMonths: number;
  schedule: string;
  /** The first occurrence still to settle. */
  next: { month: IsoMonth; due: IsoDate } | null;
};
export type OccurrenceView = {
  recurring: RecurringView;
  month: IsoMonth;
  due: IsoDate;
  state: OccurrenceState;
  /** What it recorded, once confirmed. */
  movement: MovementView | null;
};
export type AdjustmentView = {
  id: string;
  accountId: string;
  accountName: string;
  currency: Currency;
  date: IsoDate;
  delta: number;
  note: string | null;
};
export type CategoryMonthView = {
  categoryId: string;
  name: string;
  currency: Currency;
  total: number;
  expenses: MovementView[];
};
export type MoneyMonthView = {
  accounts: AccountView[];
  categories: CategoryView[];
  summary: CurrencySummary[];
  /** Where the month's Expenses went, the most money first. */
  byCategory: CategoryMonthView[];
  /** Every movement of the month, the newest first. */
  movements: MovementView[];
  adjustments: AdjustmentView[];
  recurrings: RecurringView[];
  /** The Recurrings due this month, and the unsettled ones of earlier months when it is this month. */
  occurrences: OccurrenceView[];
};

/** What the "+" offers: every Account, and the Categories Ivan uses most first. */
export type MoneyChoices = {
  accounts: { id: string; name: string; currency: Currency }[];
  categories: { id: string; name: string }[];
};

type AccountRow = typeof s.moneyAccounts.$inferSelect;
type FlowRow = {
  kind: MovementKind;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  toAmount: number | null;
  categoryId: string | null;
};

function flowView(row: FlowRow, accounts: Map<string, AccountRow>, categories: Map<string, { name: string }>): Flow {
  const from = accounts.get(row.accountId)!;
  const to = row.toAccountId ? accounts.get(row.toAccountId) : undefined;
  return {
    kind: row.kind,
    amount: row.amount,
    currency: from.currency,
    accountId: row.accountId,
    accountName: from.name,
    toAccountId: row.toAccountId,
    toAccountName: to?.name ?? null,
    toAmount: row.toAmount,
    toCurrency: to?.currency ?? null,
    categoryId: row.categoryId,
    categoryName: row.categoryId ? (categories.get(row.categoryId)?.name ?? null) : null,
  };
}

export async function getMoneyMonth(month: IsoMonth, today: IsoDate): Promise<MoneyMonthView> {
  const inMonth = (column: typeof s.moneyMovements.date | typeof s.moneyAdjustments.date) =>
    and(gte(column, `${month}-01`), lt(column, `${addMonths(month, 1)}-01`));

  const [accountRows, categoryRows, allFlows, allAdjustments, monthRows, recurringRows, resolutionRows, used] =
    await Promise.all([
      db.select().from(s.moneyAccounts).orderBy(asc(s.moneyAccounts.createdAt)),
      db
        .select({ id: s.moneyCategories.id, name: s.moneyCategories.name, expenses: count(s.moneyMovements.id) })
        .from(s.moneyCategories)
        .leftJoin(s.moneyMovements, eq(s.moneyMovements.categoryId, s.moneyCategories.id))
        .groupBy(s.moneyCategories.id)
        .orderBy(asc(s.moneyCategories.name)),
      db
        .select({
          kind: s.moneyMovements.kind,
          amount: s.moneyMovements.amount,
          accountId: s.moneyMovements.accountId,
          toAccountId: s.moneyMovements.toAccountId,
          toAmount: s.moneyMovements.toAmount,
        })
        .from(s.moneyMovements),
      db.select().from(s.moneyAdjustments).orderBy(desc(s.moneyAdjustments.date), desc(s.moneyAdjustments.createdAt)),
      db
        .select()
        .from(s.moneyMovements)
        .where(inMonth(s.moneyMovements.date))
        .orderBy(desc(s.moneyMovements.date), desc(s.moneyMovements.createdAt)),
      db.select().from(s.moneyRecurrings).orderBy(asc(s.moneyRecurrings.name)),
      db.select().from(s.moneyRecurringOccurrences),
      db
        .select({ accountId: s.moneyMovements.accountId, toAccountId: s.moneyMovements.toAccountId })
        .from(s.moneyMovements)
        .groupBy(s.moneyMovements.accountId, s.moneyMovements.toAccountId),
    ]);

  const accountMap = new Map(accountRows.map((a) => [a.id, a]));
  const categoryMap = new Map(categoryRows.map((c) => [c.id, c]));

  const inUse = new Set<string>();
  for (const u of used) {
    inUse.add(u.accountId);
    if (u.toAccountId) inUse.add(u.toAccountId);
  }
  for (const a of allAdjustments) inUse.add(a.accountId);
  for (const r of recurringRows) {
    inUse.add(r.accountId);
    if (r.toAccountId) inUse.add(r.toAccountId);
  }

  const balance = balances(accountRows, allFlows, allAdjustments);
  const monthAdjustments = allAdjustments.filter((a) => a.date.startsWith(month));
  const adjustedBy = new Map<string, number>();
  for (const a of monthAdjustments) adjustedBy.set(a.accountId, (adjustedBy.get(a.accountId) ?? 0) + a.delta);

  const accounts: AccountView[] = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    savings: a.savings,
    openingBalance: a.openingBalance,
    balance: balance.get(a.id) ?? a.openingBalance,
    monthAdjusted: adjustedBy.get(a.id) ?? null,
    inUse: inUse.has(a.id),
  }));

  const recurringUses = new Map<string, number>();
  for (const r of recurringRows) {
    if (r.categoryId) recurringUses.set(r.categoryId, (recurringUses.get(r.categoryId) ?? 0) + 1);
  }
  const categories: CategoryView[] = categoryRows.map((c) => ({ ...c, recurrings: recurringUses.get(c.id) ?? 0 }));

  const movementView = (m: typeof s.moneyMovements.$inferSelect): MovementView => ({
    ...flowView(m, accountMap, categoryMap),
    id: m.id,
    date: m.date,
    note: m.note,
  });
  const movements = monthRows.map(movementView);

  const byCategory = categoryTotals(accountRows, monthRows).map((t) => ({
    categoryId: t.categoryId,
    name: categoryMap.get(t.categoryId)?.name ?? "",
    currency: t.currency,
    total: t.total,
    expenses: movements.filter(
      (m) => m.kind === "expense" && m.categoryId === t.categoryId && m.currency === t.currency,
    ),
  }));

  const resolutions: Resolutions = new Map(
    resolutionRows.map((r) => [resolutionKey(r.recurringId, r.month), r.movementId]),
  );
  const recurrings: RecurringView[] = recurringRows.map((r) => ({
    ...flowView(r, accountMap, categoryMap),
    id: r.id,
    name: r.name,
    firstDate: r.firstDate,
    everyMonths: r.everyMonths,
    schedule: scheduleLabel(r.firstDate, r.everyMonths),
    next: nextOccurrence(r, resolutions),
  }));
  const recurringMap = new Map(recurrings.map((r) => [r.id, r]));

  const occurrenceList = occurrencesFor(recurringRows, resolutions, month, today);
  // A confirmed occurrence's movement may sit outside this month if Ivan changed its date.
  const confirmedIds = occurrenceList.flatMap((o) => (o.movementId ? [o.movementId] : []));
  const confirmed = new Map(movements.map((m) => [m.id, m]));
  const missing = confirmedIds.filter((id) => !confirmed.has(id));
  if (missing.length > 0) {
    const rows = await db.select().from(s.moneyMovements).where(inArray(s.moneyMovements.id, missing));
    for (const row of rows) confirmed.set(row.id, movementView(row));
  }
  const occurrences: OccurrenceView[] = occurrenceList.map((o) => ({
    recurring: recurringMap.get(o.recurringId)!,
    month: o.month,
    due: o.due,
    state: o.state,
    movement: o.movementId ? (confirmed.get(o.movementId) ?? null) : null,
  }));

  const adjustments: AdjustmentView[] = monthAdjustments.map((a) => ({
    id: a.id,
    accountId: a.accountId,
    accountName: accountMap.get(a.accountId)!.name,
    currency: accountMap.get(a.accountId)!.currency,
    date: a.date,
    delta: a.delta,
    note: a.note,
  }));

  return {
    accounts,
    categories,
    summary: monthSummary(accountRows, monthRows),
    byCategory,
    movements,
    adjustments,
    recurrings,
    occurrences,
  };
}

/** One Account's balance right now, for an Adjustment. */
export async function getAccountBalance(accountId: string): Promise<{ account: AccountRow; balance: number } | null> {
  const [account] = await db.select().from(s.moneyAccounts).where(eq(s.moneyAccounts.id, accountId));
  if (!account) return null;
  const [flows, adjustments] = await Promise.all([
    db
      .select({
        kind: s.moneyMovements.kind,
        amount: s.moneyMovements.amount,
        accountId: s.moneyMovements.accountId,
        toAccountId: s.moneyMovements.toAccountId,
        toAmount: s.moneyMovements.toAmount,
      })
      .from(s.moneyMovements)
      .where(or(eq(s.moneyMovements.accountId, accountId), eq(s.moneyMovements.toAccountId, accountId))),
    db.select().from(s.moneyAdjustments).where(eq(s.moneyAdjustments.accountId, accountId)),
  ]);
  const balance = balances([account], flows, adjustments).get(account.id) ?? account.openingBalance;
  return { account, balance };
}

export async function getMoneyChoices(): Promise<MoneyChoices> {
  const [accounts, categories] = await Promise.all([
    db
      .select({ id: s.moneyAccounts.id, name: s.moneyAccounts.name, currency: s.moneyAccounts.currency })
      .from(s.moneyAccounts)
      .orderBy(asc(s.moneyAccounts.createdAt)),
    db
      .select({ id: s.moneyCategories.id, name: s.moneyCategories.name, uses: count(s.moneyMovements.id) })
      .from(s.moneyCategories)
      .leftJoin(s.moneyMovements, eq(s.moneyMovements.categoryId, s.moneyCategories.id))
      .groupBy(s.moneyCategories.id)
      .orderBy(desc(count(s.moneyMovements.id)), asc(s.moneyCategories.name)),
  ]);
  return { accounts, categories: categories.map(({ id, name }) => ({ id, name })) };
}
