import "server-only";
import { and, asc, count, desc, eq, gte, lt } from "drizzle-orm";
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

export type AccountView = AccountRef & { name: string; balance: number; movements: number };
export type CategoryView = { id: string; name: string; expenses: number };
export type MovementView = {
  id: string;
  kind: MovementKind;
  date: IsoDate;
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
};

/** What the "+" offers: every Account, and the Categories Ivan uses most first. */
export type MoneyChoices = {
  accounts: { id: string; name: string; currency: Currency }[];
  categories: { id: string; name: string }[];
};

async function getAccounts(): Promise<AccountView[]> {
  const [accounts, all, used] = await Promise.all([
    db.select().from(s.moneyAccounts).orderBy(asc(s.moneyAccounts.createdAt)),
    db
      .select({
        kind: s.moneyMovements.kind,
        amount: s.moneyMovements.amount,
        accountId: s.moneyMovements.accountId,
        toAccountId: s.moneyMovements.toAccountId,
        toAmount: s.moneyMovements.toAmount,
      })
      .from(s.moneyMovements),
    db.select({ accountId: s.moneyMovements.accountId, n: count() }).from(s.moneyMovements).groupBy(s.moneyMovements.accountId),
  ]);
  const incoming = new Map<string, number>();
  for (const m of all) if (m.toAccountId) incoming.set(m.toAccountId, (incoming.get(m.toAccountId) ?? 0) + 1);
  const outgoing = new Map(used.map((u) => [u.accountId, u.n]));
  const balance = balances(accounts, all);
  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
    savings: a.savings,
    openingBalance: a.openingBalance,
    balance: balance.get(a.id) ?? a.openingBalance,
    movements: (outgoing.get(a.id) ?? 0) + (incoming.get(a.id) ?? 0),
  }));
}

async function getCategories(): Promise<CategoryView[]> {
  const rows = await db
    .select({ id: s.moneyCategories.id, name: s.moneyCategories.name, expenses: count(s.moneyMovements.id) })
    .from(s.moneyCategories)
    .leftJoin(s.moneyMovements, eq(s.moneyMovements.categoryId, s.moneyCategories.id))
    .groupBy(s.moneyCategories.id)
    .orderBy(asc(s.moneyCategories.name));
  return rows;
}

export async function getMoneyMonth(month: IsoMonth): Promise<MoneyMonthView> {
  const [accounts, categories, rows] = await Promise.all([
    getAccounts(),
    getCategories(),
    db
      .select()
      .from(s.moneyMovements)
      .where(and(gte(s.moneyMovements.date, `${month}-01`), lt(s.moneyMovements.date, `${addMonths(month, 1)}-01`)))
      .orderBy(desc(s.moneyMovements.date), desc(s.moneyMovements.createdAt)),
  ]);
  const account = new Map(accounts.map((a) => [a.id, a]));
  const category = new Map(categories.map((c) => [c.id, c]));

  const movements: MovementView[] = rows.map((m) => {
    const from = account.get(m.accountId)!;
    const to = m.toAccountId ? account.get(m.toAccountId) : undefined;
    return {
      id: m.id,
      kind: m.kind,
      date: m.date,
      amount: m.amount,
      currency: from.currency,
      accountId: m.accountId,
      accountName: from.name,
      toAccountId: m.toAccountId,
      toAccountName: to?.name ?? null,
      toAmount: m.toAmount,
      toCurrency: to?.currency ?? null,
      categoryId: m.categoryId,
      categoryName: m.categoryId ? (category.get(m.categoryId)?.name ?? null) : null,
      note: m.note,
    };
  });

  const byCategory = categoryTotals(accounts, rows).map((t) => ({
    categoryId: t.categoryId,
    name: category.get(t.categoryId)?.name ?? "",
    currency: t.currency,
    total: t.total,
    expenses: movements.filter(
      (m) => m.kind === "expense" && m.categoryId === t.categoryId && m.currency === t.currency,
    ),
  }));

  return { accounts, categories, summary: monthSummary(accounts, rows), byCategory, movements };
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
