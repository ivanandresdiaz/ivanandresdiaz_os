"use server";

import { eq, inArray, or, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { isIsoDate } from "@/domain/dates";
import {
  CURRENCIES,
  MAX_AMOUNT,
  MAX_MONEY_NAME,
  MAX_MOVEMENT_NOTE,
  MOVEMENT_KINDS,
  movementProblem,
} from "@/domain/money";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import { getMoneyChoices, type MoneyChoices } from "./money";

/** What a form needs back: nothing when it worked, or what to tell Ivan. */
export type MoneyResult = { error: string } | null;

const name = z.string().trim().min(1).max(MAX_MONEY_NAME);
const units = z.number().int().positive().max(MAX_AMOUNT);
const balance = z.number().int().min(-MAX_AMOUNT).max(MAX_AMOUNT);

async function done() {
  refresh();
}

/** A unique-name clash in Postgres, so the form can say it in words. */
function isNameTaken(error: unknown): boolean {
  const code = (error as { cause?: { code?: string }; code?: string })?.cause?.code ?? (error as { code?: string })?.code;
  return code === "23505";
}

/** For the "+": the Accounts and Categories to pick from, and today in Ivan's timezone. */
export async function loadMoneyChoices(): Promise<MoneyChoices & { today: string }> {
  await requireIvan();
  return { ...(await getMoneyChoices()), today: today() };
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
    if (isNameTaken(error)) return { error: `There is already an Account called “${v.name}”.` };
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
    if (isNameTaken(error)) return { error: `There is already an Account called “${v.name}”.` };
    throw error;
  }
  await done();
  return null;
}

/** Only an Account nothing ever moved through; one with history keeps it. */
export async function deleteAccount(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  const [used] = await db
    .select({ id: s.moneyMovements.id })
    .from(s.moneyMovements)
    .where(or(eq(s.moneyMovements.accountId, id), eq(s.moneyMovements.toAccountId, id)))
    .limit(1);
  if (used) throw new Error("This Account has movements; it can't be deleted.");
  await db.delete(s.moneyAccounts).where(eq(s.moneyAccounts.id, id));
  await done();
}

// ─── Categories ──────────────────────────────────────────────────────────────

/** Creating one that already exists (any case) gives back that one, so the "+" never makes twins. */
export async function createCategory(input: { name: string }): Promise<{ id: string; name: string }> {
  await requireIvan();
  const v = z.object({ name }).parse(input);
  const [existing] = await db
    .select({ id: s.moneyCategories.id, name: s.moneyCategories.name })
    .from(s.moneyCategories)
    .where(eq(sql`lower(${s.moneyCategories.name})`, v.name.toLowerCase()))
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
      .where(eq(sql`lower(${s.moneyCategories.name})`, v.name.toLowerCase()));
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
    if (isNameTaken(error)) return { error: `There is already a Category called “${v.name}”. Merge into it instead.` };
    throw error;
  }
  await done();
  return null;
}

/** Its Expenses move to `intoId` and it disappears (Q7). */
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
    await tx.delete(s.moneyCategories).where(eq(s.moneyCategories.id, v.id));
  });
  await done();
}

/** Only an empty Category; one with Expenses is merged instead, so no money leaves the history. */
export async function deleteCategory(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  const [used] = await db
    .select({ id: s.moneyMovements.id })
    .from(s.moneyMovements)
    .where(eq(s.moneyMovements.categoryId, id))
    .limit(1);
  if (used) throw new Error("This Category has Expenses; merge it into another instead.");
  await db.delete(s.moneyCategories).where(eq(s.moneyCategories.id, id));
  await done();
}

// ─── Movements ───────────────────────────────────────────────────────────────

const movementInput = z.object({
  id: z.uuid().optional(),
  kind: z.enum(MOVEMENT_KINDS),
  date: z.string().refine(isIsoDate, "Not a date"),
  amount: units,
  accountId: z.uuid(),
  toAccountId: z.uuid().nullable(),
  toAmount: units.nullable(),
  categoryId: z.uuid().nullable(),
  note: z
    .string()
    .trim()
    .max(MAX_MOVEMENT_NOTE)
    .transform((v) => v || null),
});

/** Adds a movement, or changes it when it has an `id`. Only what its kind uses is kept. */
export async function saveMovement(input: z.input<typeof movementInput>): Promise<MoneyResult> {
  await requireIvan();
  const v = movementInput.parse(input);
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

  const row = {
    kind: v.kind,
    date: v.date,
    amount: v.amount,
    accountId: v.accountId,
    toAccountId: v.kind === "transfer" ? v.toAccountId : null,
    // The same currency on both sides: what left is what arrived.
    toAmount: v.kind === "transfer" ? (to!.currency === from.currency ? v.amount : v.toAmount) : null,
    categoryId: v.kind === "expense" ? v.categoryId : null,
    note: v.note,
  };
  if (v.id) await db.update(s.moneyMovements).set(row).where(eq(s.moneyMovements.id, v.id));
  else await db.insert(s.moneyMovements).values(row);
  await done();
  return null;
}

export async function deleteMovement(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  await db.delete(s.moneyMovements).where(eq(s.moneyMovements.id, id));
  await done();
}
