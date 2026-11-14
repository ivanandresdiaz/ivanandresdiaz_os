"use server";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { isIsoDate, isIsoMonth } from "@/domain/dates";
import {
  CURRENCIES,
  MAX_AMOUNT,
  MAX_MONEY_NAME,
  MAX_MOVEMENT_NOTE,
  MOVEMENT_KINDS,
  movementProblem,
  type MovementKind,
} from "@/domain/money";
import { dueDateIn, MAX_EVERY_MONTHS } from "@/domain/recurring";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import { getAccountBalance, getMoneyChoices, type MoneyChoices } from "./money";

/** What a form needs back: nothing when it worked, or what to tell Ivan. */
export type MoneyResult = { error: string } | null;

const name = z.string().trim().min(1).max(MAX_MONEY_NAME);
const units = z.number().int().positive().max(MAX_AMOUNT);
const balance = z.number().int().min(-MAX_AMOUNT).max(MAX_AMOUNT);
const isoDate = z.string().refine(isIsoDate, "Not a date");
const isoMonth = z.string().refine(isIsoMonth, "Not a month");
const note = z
  .string()
  .trim()
  .max(MAX_MOVEMENT_NOTE)
  .transform((v) => v || null);

async function done() {
  refresh();
}

/** A unique clash in Postgres, so the form can say it in words. */
function isUniqueClash(error: unknown): boolean {
  const code = (error as { cause?: { code?: string }; code?: string })?.cause?.code ?? (error as { code?: string })?.code;
  return code === "23505";
}

/** For the "+": the Accounts and Categories to pick from, and today in Ivan's timezone. */
export async function loadMoneyChoices(): Promise<MoneyChoices & { today: string }> {
  await requireIvan();
  return { ...(await getMoneyChoices()), today: today() };
}

// ─── What moves ──────────────────────────────────────────────────────────────

const flowInput = {
  kind: z.enum(MOVEMENT_KINDS),
  amount: units,
  accountId: z.uuid(),
  toAccountId: z.uuid().nullable(),
  toAmount: units.nullable(),
  categoryId: z.uuid().nullable(),
};
type FlowInput = {
  kind: MovementKind;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  toAmount: number | null;
  categoryId: string | null;
};

/**
 * What a movement or a Recurring keeps, checked against the Accounts and
 * Categories that exist: only the fields its kind uses, and what arrived
 * equal to what left when the currency doesn't change.
 */
async function checkFlow(v: FlowInput): Promise<{ error: string } | { flow: FlowInput }> {
  const ids = [v.accountId, ...(v.kind === "transfer" && v.toAccountId ? [v.toAccountId] : [])];
  const accounts = await db
    .select({ id: s.moneyAccounts.id, currency: s.moneyAccounts.currency })
    .from(s.moneyAccounts)
    .where(inArray(s.moneyAccounts.id, ids));
  const from = accounts.find((a) => a.id === v.accountId);
  if (!from) return { error: "That Account no longer exists." };

  const to = v.kind === "transfer" ? accounts.find((a) => a.id === v.toAccountId) : undefined;
  const problem = movementProblem(
    v.kind === "expense"
      ? { kind: "expense", categoryId: v.categoryId }
      : v.kind === "income"
        ? { kind: "income" }
        : {
            kind: "transfer",
            from: from.currency,
            to: to?.currency ?? null,
            sameAccount: v.toAccountId === v.accountId,
            toAmount: v.toAmount,
          },
  );
  if (problem) return { error: problem };

  if (v.kind === "expense") {
    const [category] = await db
      .select({ id: s.moneyCategories.id })
      .from(s.moneyCategories)
      .where(eq(s.moneyCategories.id, v.categoryId!));
    if (!category) return { error: "That Category no longer exists." };
  }

  return {
    flow: {
      kind: v.kind,
      amount: v.amount,
      accountId: v.accountId,
      toAccountId: v.kind === "transfer" ? v.toAccountId : null,
      toAmount: v.kind === "transfer" ? (to!.currency === from.currency ? v.amount : v.toAmount) : null,
      categoryId: v.kind === "expense" ? v.categoryId : null,
    },
  };
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export async function createAccount(input: {
  name: string;
  currency: string;
  savings: boolean;
  openingBalance: number;
}): Promise<MoneyResult> {
  await requireIvan();
  const v = z
    .object({ name, currency: z.enum(CURRENCIES), savings: z.boolean(), openingBalance: balance })
    .parse(input);
  try {
    await db.insert(s.moneyAccounts).values(v);
  } catch (error) {
    if (isUniqueClash(error)) return { error: `There is already an Account called “${v.name}”.` };
    throw error;
  }
  await done();
  return null;
}

/** Its currency never changes: the amounts it already holds are in that currency. */
export async function updateAccount(input: {
  id: string;
  name: string;
  savings: boolean;
  openingBalance: number;
}): Promise<MoneyResult> {
  await requireIvan();
  const v = z.object({ id: z.uuid(), name, savings: z.boolean(), openingBalance: balance }).parse(input);
  try {
    await db
      .update(s.moneyAccounts)
      .set({ name: v.name, savings: v.savings, openingBalance: v.openingBalance })
      .where(eq(s.moneyAccounts.id, v.id));
  } catch (error) {
    if (isUniqueClash(error)) return { error: `There is already an Account called “${v.name}”.` };
    throw error;
  }
  await done();
  return null;
}

/** Only an Account nothing points at: no movements, Adjustments or Recurrings. */
export async function deleteAccount(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  const [moved, adjusted, recurring] = await Promise.all([
    db
      .select({ id: s.moneyMovements.id })
      .from(s.moneyMovements)
      .where(or(eq(s.moneyMovements.accountId, id), eq(s.moneyMovements.toAccountId, id)))
      .limit(1),
    db.select({ id: s.moneyAdjustments.id }).from(s.moneyAdjustments).where(eq(s.moneyAdjustments.accountId, id)).limit(1),
    db
      .select({ id: s.moneyRecurrings.id })
      .from(s.moneyRecurrings)
      .where(or(eq(s.moneyRecurrings.accountId, id), eq(s.moneyRecurrings.toAccountId, id)))
      .limit(1),
  ]);
  if (moved.length || adjusted.length || recurring.length) throw new Error("This Account is in use; it can't be deleted.");
  await db.delete(s.moneyAccounts).where(eq(s.moneyAccounts.id, id));
  await done();
}

/**
 * Sets an Account to its real balance (Q11): the difference is kept as an
 * Adjustment, which is neither an Expense nor an Income.
 */
export async function adjustAccount(input: { accountId: string; realBalance: number; note: string }): Promise<MoneyResult> {
  await requireIvan();
  const v = z.object({ accountId: z.uuid(), realBalance: balance, note }).parse(input);
  const found = await getAccountBalance(v.accountId);
  if (!found) return { error: "That Account no longer exists." };
  const delta = v.realBalance - found.balance;
  if (delta === 0) return { error: "It already matches; nothing to adjust." };
  // Today: it says what the Account holds now.
  await db.insert(s.moneyAdjustments).values({ accountId: v.accountId, date: today(), delta, note: v.note });
  await done();
  return null;
}

export async function deleteAdjustment(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  await db.delete(s.moneyAdjustments).where(eq(s.moneyAdjustments.id, id));
  await done();
}

// ─── Categories ──────────────────────────────────────────────────────────────

/** Creating one that already exists (any case) gives back that one, so the "+" never makes twins. */
export async function createCategory(input: { name: string }): Promise<{ id: string; name: string }> {
  await requireIvan();
  const v = z.object({ name }).parse(input);
  const byName = eq(sql`lower(${s.moneyCategories.name})`, v.name.toLowerCase());
  const [existing] = await db
    .select({ id: s.moneyCategories.id, name: s.moneyCategories.name })
    .from(s.moneyCategories)
    .where(byName)
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(s.moneyCategories)
    .values({ name: v.name })
    .onConflictDoNothing()
    .returning({ id: s.moneyCategories.id, name: s.moneyCategories.name });
  if (!created) {
    const [raced] = await db
      .select({ id: s.moneyCategories.id, name: s.moneyCategories.name })
      .from(s.moneyCategories)
      .where(byName);
    return raced;
  }
  await done();
  return created;
}

export async function renameCategory(input: { id: string; name: string }): Promise<MoneyResult> {
  await requireIvan();
  const v = z.object({ id: z.uuid(), name }).parse(input);
  try {
    await db.update(s.moneyCategories).set({ name: v.name }).where(eq(s.moneyCategories.id, v.id));
  } catch (error) {
    if (isUniqueClash(error)) return { error: `There is already a Category called “${v.name}”. Merge into it instead.` };
    throw error;
  }
  await done();
  return null;
}

/** Its Expenses and Bills move to `intoId` and it disappears (Q7). */
export async function mergeCategory(input: { id: string; intoId: string }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), intoId: z.uuid() }).parse(input);
  if (v.id === v.intoId) return;
  await db.transaction(async (tx) => {
    const found = await tx
      .select({ id: s.moneyCategories.id })
      .from(s.moneyCategories)
      .where(inArray(s.moneyCategories.id, [v.id, v.intoId]));
    if (found.length !== 2) throw new Error("That Category no longer exists.");
    await tx.update(s.moneyMovements).set({ categoryId: v.intoId }).where(eq(s.moneyMovements.categoryId, v.id));
    await tx.update(s.moneyRecurrings).set({ categoryId: v.intoId }).where(eq(s.moneyRecurrings.categoryId, v.id));
    await tx.delete(s.moneyCategories).where(eq(s.moneyCategories.id, v.id));
  });
  await done();
}

/** Only an empty Category; one with Expenses or Bills is merged instead, so no money leaves the history. */
export async function deleteCategory(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  const [spent, billed] = await Promise.all([
    db.select({ id: s.moneyMovements.id }).from(s.moneyMovements).where(eq(s.moneyMovements.categoryId, id)).limit(1),
    db.select({ id: s.moneyRecurrings.id }).from(s.moneyRecurrings).where(eq(s.moneyRecurrings.categoryId, id)).limit(1),
  ]);
  if (spent.length || billed.length) throw new Error("This Category is in use; merge it into another instead.");
  await db.delete(s.moneyCategories).where(eq(s.moneyCategories.id, id));
  await done();
}

// ─── Movements ───────────────────────────────────────────────────────────────

const movementInput = z.object({
  id: z.uuid().optional(),
  ...flowInput,
  date: isoDate,
  note,
  /** Confirming a Recurring with what really happened: it settles that month's occurrence. */
  occurrence: z.object({ recurringId: z.uuid(), month: isoMonth }).optional(),
});

/** Adds a movement, or changes it when it has an `id`. Only what its kind uses is kept. */
export async function saveMovement(input: z.input<typeof movementInput>): Promise<MoneyResult> {
  await requireIvan();
  const v = movementInput.parse(input);
  const checked = await checkFlow(v);
  if ("error" in checked) return checked;
  const row = { ...checked.flow, date: v.date, note: v.note };

  if (v.id) {
    await db.update(s.moneyMovements).set(row).where(eq(s.moneyMovements.id, v.id));
  } else if (v.occurrence) {
    const settled = await settle(v.occurrence.recurringId, v.occurrence.month, row);
    if (settled) return settled;
  } else {
    await db.insert(s.moneyMovements).values(row);
  }
  await done();
  return null;
}

/** Records `row` and marks the occurrence as confirmed by it, both or neither. */
async function settle(
  recurringId: string,
  month: string,
  row: typeof s.moneyMovements.$inferInsert,
): Promise<MoneyResult> {
  try {
    await db.transaction(async (tx) => {
      const [movement] = await tx.insert(s.moneyMovements).values(row).returning({ id: s.moneyMovements.id });
      await tx.insert(s.moneyRecurringOccurrences).values({ recurringId, month, movementId: movement.id });
    });
  } catch (error) {
    if (isUniqueClash(error)) return { error: "That one is already settled." };
    throw error;
  }
  return null;
}

/** Deleting what a Recurring recorded makes that occurrence pending again. */
export async function deleteMovement(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  await db.delete(s.moneyMovements).where(eq(s.moneyMovements.id, id));
  await done();
}

// ─── Recurrings ──────────────────────────────────────────────────────────────

const recurringInput = z.object({
  id: z.uuid().optional(),
  name,
  ...flowInput,
  firstDate: isoDate,
  everyMonths: z.number().int().min(1).max(MAX_EVERY_MONTHS),
});

/** Creates a Recurring or changes it; a change applies to the occurrences still to settle. */
export async function saveRecurring(input: z.input<typeof recurringInput>): Promise<MoneyResult> {
  await requireIvan();
  const v = recurringInput.parse(input);
  const checked = await checkFlow(v);
  if ("error" in checked) return checked;
  const row = { ...checked.flow, name: v.name, firstDate: v.firstDate, everyMonths: v.everyMonths };
  if (v.id) await db.update(s.moneyRecurrings).set(row).where(eq(s.moneyRecurrings.id, v.id));
  else await db.insert(s.moneyRecurrings).values(row);
  await done();
  return null;
}

/** Stops it: its unsettled occurrences go; what it recorded stays as plain movements. */
export async function deleteRecurring(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  await db.delete(s.moneyRecurrings).where(eq(s.moneyRecurrings.id, id));
  await done();
}

const occurrenceInput = z.object({ recurringId: z.uuid(), month: isoMonth });

/** One tap (Q10): records the Recurring as it is, on the day it was due, with its name as the note. */
export async function confirmOccurrence(input: { recurringId: string; month: string }): Promise<MoneyResult> {
  await requireIvan();
  const v = occurrenceInput.parse(input);
  const [rule] = await db.select().from(s.moneyRecurrings).where(eq(s.moneyRecurrings.id, v.recurringId));
  if (!rule) return { error: "That Recurring no longer exists." };
  const due = dueDateIn(rule.firstDate, rule.everyMonths, v.month);
  if (!due) return { error: "It isn't due that month." };
  const settled = await settle(rule.id, v.month, {
    kind: rule.kind,
    amount: rule.amount,
    accountId: rule.accountId,
    toAccountId: rule.toAccountId,
    toAmount: rule.toAmount,
    categoryId: rule.categoryId,
    date: due,
    note: rule.name,
  });
  if (settled) return settled;
  await done();
  return null;
}

/** Not this month (Q3): it stops asking, and nothing is recorded. */
export async function skipOccurrence(input: { recurringId: string; month: string }) {
  await requireIvan();
  const v = occurrenceInput.parse(input);
  const [rule] = await db.select().from(s.moneyRecurrings).where(eq(s.moneyRecurrings.id, v.recurringId));
  if (!rule || !dueDateIn(rule.firstDate, rule.everyMonths, v.month)) return;
  await db.insert(s.moneyRecurringOccurrences).values(v).onConflictDoNothing();
  await done();
}

/** A skip undone: it asks again. */
export async function unskipOccurrence(input: { recurringId: string; month: string }) {
  await requireIvan();
  const v = occurrenceInput.parse(input);
  await db
    .delete(s.moneyRecurringOccurrences)
    .where(
      and(
        eq(s.moneyRecurringOccurrences.recurringId, v.recurringId),
        eq(s.moneyRecurringOccurrences.month, v.month),
        isNull(s.moneyRecurringOccurrences.movementId),
      ),
    );
  await done();
}
