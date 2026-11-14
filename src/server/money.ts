import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { addMonths, type IsoDate, type IsoMonth } from "@/domain/dates";
import {
  balances,
  campaignMoney,
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
import { debtLeft, debtState, type DebtSide, type DebtState } from "@/domain/debts";
import { presignView } from "@/lib/r2";

export type AccountView = AccountRef & {
  name: string;
  balance: number;
  /** What its Adjustments added up to in the month shown, when it had any. */
  monthAdjusted: number | null;
  /** Movements, Adjustments or Recurrings point at it, so it can't be deleted. */
  inUse: boolean;
};
export type CategoryKind = "expense" | "income";
/** `expenses` counts every movement in it: Expenses, or Incomes for an Income Category. */
export type CategoryView = {
  id: string;
  kind: CategoryKind;
  name: string;
  expenses: number;
  recurrings: number;
  /** Debts paid or collected in it. */
  debts: number;
};

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
export type ReceiptView = { id: string; name: string; contentType: string; url: string };
/** A Campaign an Expense or an Income serves. */
export type CampaignRef = { id: string; title: string };
export type MovementView = Flow & {
  id: string;
  date: IsoDate;
  note: string | null;
  receipts: ReceiptView[];
  campaigns: CampaignRef[];
  /** The Debt it paid, collected or started. */
  debt: { id: string; who: string } | null;
};
export type RecurringView = Flow & {
  id: string;
  name: string;
  campaigns: CampaignRef[];
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
  /** Null gathers Income recorded before Income had Categories. */
  categoryId: string | null;
  name: string;
  currency: Currency;
  total: number;
  expenses: MovementView[];
};
export type MoneyMonthView = {
  month: IsoMonth;
  accounts: AccountView[];
  categories: CategoryView[];
  summary: CurrencySummary[];
  /** Where the month's Expenses went, the most money first. */
  byCategory: CategoryMonthView[];
  /** Where the month's Income came from, the most money first. */
  incomeByCategory: CategoryMonthView[];
  /** Every movement of the month, the newest first. */
  movements: MovementView[];
  adjustments: AdjustmentView[];
  recurrings: RecurringView[];
  /** The Recurrings due this month, and the unsettled ones of earlier months when it is this month. */
  occurrences: OccurrenceView[];
  /** Every Debt, open or not: they don't belong to a month. */
  debts: DebtView[];
};

export type DebtPaymentView = {
  id: string;
  date: IsoDate;
  amount: number;
  /** The movement it recorded, when it moved an Account. */
  movementId: string | null;
  accountName: string | null;
};
export type DebtView = {
  id: string;
  side: DebtSide;
  who: string;
  amount: number;
  left: number;
  state: DebtState;
  dueDate: IsoDate | null;
  note: string | null;
  categoryId: string;
  categoryName: string;
  /** Its reminder, while it exists. */
  reminder: { id: string; day: IsoDate; done: boolean } | null;
  payments: DebtPaymentView[];
};

/** What the "+" offers: every Account, the Categories Ivan uses most first, and the active Campaigns by priority. */
export type MoneyChoices = {
  accounts: { id: string; name: string; currency: Currency }[];
  categories: { id: string; kind: CategoryKind; name: string }[];
  campaigns: CampaignRef[];
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
        .select({
          id: s.moneyCategories.id,
          kind: s.moneyCategories.kind,
          name: s.moneyCategories.name,
          expenses: count(s.moneyMovements.id),
        })
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
  const debts = await getDebts(accountMap, categoryMap);
  const debtUses = new Map<string, number>();
  for (const d of debts) debtUses.set(d.categoryId, (debtUses.get(d.categoryId) ?? 0) + 1);
  const categories: CategoryView[] = categoryRows.map((c) => ({
    ...c,
    recurrings: recurringUses.get(c.id) ?? 0,
    debts: debtUses.get(c.id) ?? 0,
  }));

  const movementView = (m: typeof s.moneyMovements.$inferSelect): MovementView => ({
    ...flowView(m, accountMap, categoryMap),
    id: m.id,
    date: m.date,
    note: m.note,
    receipts: [],
    campaigns: [],
    debt: null,
  });
  const movements = monthRows.map(movementView);

  const totalsOf = (kind: CategoryKind): CategoryMonthView[] =>
    categoryTotals(accountRows, monthRows, kind).map((t) => ({
      categoryId: t.categoryId,
      name: t.categoryId ? (categoryMap.get(t.categoryId)?.name ?? "") : "No Category",
      currency: t.currency,
      total: t.total,
      expenses: movements.filter(
        (m) => m.kind === kind && m.categoryId === t.categoryId && m.currency === t.currency,
      ),
    }));
  const byCategory = totalsOf("expense");
  const incomeByCategory = totalsOf("income");

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
    campaigns: [],
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
  await Promise.all([
    addReceipts([...confirmed.values()]),
    addCampaigns([...confirmed.values()]),
    addRecurringCampaigns(recurrings),
  ]);
  // Which movements paid, collected or started a Debt.
  const debtOf = new Map<string, { id: string; who: string }>();
  for (const d of debts) {
    for (const p of d.payments) if (p.movementId) debtOf.set(p.movementId, { id: d.id, who: d.who });
  }
  for (const row of await db
    .select({ id: s.moneyDebts.id, who: s.moneyDebts.who, movementId: s.moneyDebts.openingMovementId })
    .from(s.moneyDebts)) {
    if (row.movementId) debtOf.set(row.movementId, { id: row.id, who: row.who });
  }
  for (const m of confirmed.values()) m.debt = debtOf.get(m.id) ?? null;

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
    month,
    accounts,
    categories,
    summary: monthSummary(accountRows, monthRows),
    byCategory,
    incomeByCategory,
    movements,
    adjustments,
    recurrings,
    occurrences,
    debts,
  };
}

/** Every Debt with its payments and reminder; open ones first, the nearest due first. */
async function getDebts(
  accounts: Map<string, AccountRow>,
  categories: Map<string, { name: string }>,
): Promise<DebtView[]> {
  const [debtRows, paymentRows] = await Promise.all([
    db
      .select({ debt: s.moneyDebts, reminder: s.secondaryTasks })
      .from(s.moneyDebts)
      .leftJoin(s.secondaryTasks, eq(s.secondaryTasks.id, s.moneyDebts.reminderId))
      .orderBy(asc(s.moneyDebts.createdAt)),
    db
      .select({ payment: s.moneyDebtPayments, accountId: s.moneyMovements.accountId })
      .from(s.moneyDebtPayments)
      .leftJoin(s.moneyMovements, eq(s.moneyMovements.id, s.moneyDebtPayments.movementId))
      .orderBy(desc(s.moneyDebtPayments.date), desc(s.moneyDebtPayments.createdAt)),
  ]);
  const paymentsOf = new Map<string, DebtPaymentView[]>();
  for (const { payment: p, accountId } of paymentRows) {
    const list = paymentsOf.get(p.debtId) ?? [];
    list.push({
      id: p.id,
      date: p.date,
      amount: p.amount,
      movementId: p.movementId,
      accountName: accountId ? (accounts.get(accountId)?.name ?? null) : null,
    });
    paymentsOf.set(p.debtId, list);
  }
  const views: DebtView[] = debtRows.map(({ debt: d, reminder: r }) => {
    const payments = paymentsOf.get(d.id) ?? [];
    return {
      id: d.id,
      side: d.side,
      who: d.who,
      amount: d.amount,
      left: debtLeft(d.amount, payments),
      state: debtState(d, payments),
      dueDate: d.dueDate,
      note: d.note,
      categoryId: d.categoryId,
      categoryName: categories.get(d.categoryId)?.name ?? "",
      reminder: r ? { id: r.id, day: r.day, done: r.doneAt !== null } : null,
      payments,
    };
  });
  const rank = (d: DebtView) => (d.state === "open" ? 0 : 1);
  return views.sort((a, b) => rank(a) - rank(b) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}

/** Fills in each movement's Receipts, with a link to open each one. */
async function addReceipts(movements: MovementView[]) {
  if (movements.length === 0) return;
  const byId = new Map(movements.map((m) => [m.id, m]));
  const rows = await db
    .select()
    .from(s.moneyReceipts)
    .where(inArray(s.moneyReceipts.movementId, [...byId.keys()]))
    .orderBy(asc(s.moneyReceipts.createdAt));
  const links = await Promise.all(rows.map((r) => presignView(r.key)));
  rows.forEach((r, i) => {
    byId.get(r.movementId)!.receipts.push({ id: r.id, name: r.name, contentType: r.contentType, url: links[i] });
  });
}

/** Fills in the Campaigns each movement serves. */
async function addCampaigns(movements: MovementView[]) {
  if (movements.length === 0) return;
  const byId = new Map(movements.map((m) => [m.id, m]));
  const rows = await db
    .select({ movementId: s.moneyMovementCampaigns.movementId, id: s.campaigns.id, title: s.campaigns.title })
    .from(s.moneyMovementCampaigns)
    .innerJoin(s.campaigns, eq(s.campaigns.id, s.moneyMovementCampaigns.campaignId))
    .where(inArray(s.moneyMovementCampaigns.movementId, [...byId.keys()]))
    .orderBy(asc(s.campaigns.position), asc(s.campaigns.title));
  for (const r of rows) byId.get(r.movementId)!.campaigns.push({ id: r.id, title: r.title });
}

/** Fills in the Campaigns each Recurring carries. */
async function addRecurringCampaigns(recurrings: RecurringView[]) {
  if (recurrings.length === 0) return;
  const byId = new Map(recurrings.map((r) => [r.id, r]));
  const rows = await db
    .select({ recurringId: s.moneyRecurringCampaigns.recurringId, id: s.campaigns.id, title: s.campaigns.title })
    .from(s.moneyRecurringCampaigns)
    .innerJoin(s.campaigns, eq(s.campaigns.id, s.moneyRecurringCampaigns.campaignId))
    .where(inArray(s.moneyRecurringCampaigns.recurringId, [...byId.keys()]))
    .orderBy(asc(s.campaigns.position), asc(s.campaigns.title));
  for (const r of rows) byId.get(r.recurringId)!.campaigns.push({ id: r.id, title: r.title });
}

export type CampaignMoneyView = {
  spent: number;
  cameIn: number;
  /** Every Expense and Income that served it, the newest first, from all months. */
  movements: MovementView[];
};

/** What a Campaign's page shows of money (Q11): a record, not a budget. */
export async function getCampaignMoney(campaignId: string): Promise<CampaignMoneyView> {
  const rows = await db
    .select({ movement: s.moneyMovements })
    .from(s.moneyMovementCampaigns)
    .innerJoin(s.moneyMovements, eq(s.moneyMovements.id, s.moneyMovementCampaigns.movementId))
    .where(eq(s.moneyMovementCampaigns.campaignId, campaignId))
    .orderBy(desc(s.moneyMovements.date), desc(s.moneyMovements.createdAt));
  if (rows.length === 0) return { spent: 0, cameIn: 0, movements: [] };
  const [accountRows, categoryRows] = await Promise.all([
    db.select().from(s.moneyAccounts),
    db.select({ id: s.moneyCategories.id, name: s.moneyCategories.name }).from(s.moneyCategories),
  ]);
  const accounts = new Map(accountRows.map((a) => [a.id, a]));
  const categories = new Map(categoryRows.map((c) => [c.id, c]));
  const movements: MovementView[] = rows.map(({ movement: m }) => ({
    ...flowView(m, accounts, categories),
    id: m.id,
    date: m.date,
    note: m.note,
    receipts: [],
    campaigns: [],
    debt: null,
  }));
  await Promise.all([addReceipts(movements), addCampaigns(movements)]);
  return { ...campaignMoney(movements), movements };
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
  const [accounts, categories, campaigns] = await Promise.all([
    db
      .select({ id: s.moneyAccounts.id, name: s.moneyAccounts.name, currency: s.moneyAccounts.currency })
      .from(s.moneyAccounts)
      .orderBy(asc(s.moneyAccounts.createdAt)),
    db
      .select({
        id: s.moneyCategories.id,
        kind: s.moneyCategories.kind,
        name: s.moneyCategories.name,
        uses: count(s.moneyMovements.id),
      })
      .from(s.moneyCategories)
      .leftJoin(s.moneyMovements, eq(s.moneyMovements.categoryId, s.moneyCategories.id))
      .groupBy(s.moneyCategories.id)
      .orderBy(desc(count(s.moneyMovements.id)), asc(s.moneyCategories.name)),
    // The newest Quarter first, then each Quarter's priority.
    db
      .select({ id: s.campaigns.id, title: s.campaigns.title })
      .from(s.campaigns)
      .leftJoin(s.quarters, eq(s.quarters.id, s.campaigns.quarterId))
      .where(eq(s.campaigns.status, "active"))
      .orderBy(desc(s.quarters.year), desc(s.quarters.quarter), asc(s.campaigns.position), asc(s.campaigns.title)),
  ]);
  return { accounts, categories: categories.map(({ id, kind, name }) => ({ id, kind, name })), campaigns };
}
