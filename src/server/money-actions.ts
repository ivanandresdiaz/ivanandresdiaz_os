"use server";

import { and, count, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { isIsoDate, isIsoMonth } from "@/domain/dates";
import {
  CURRENCIES,
  MAX_AMOUNT,
  MAX_MOVEMENT_CAMPAIGNS,
  MAX_MONEY_NAME,
  MAX_MOVEMENT_NOTE,
  MOVEMENT_KINDS,
  movementProblem,
  servesCampaigns,
  type MovementKind,
} from "@/domain/money";
import {
  isReceiptKey,
  MAX_RECEIPT_NAME,
  MAX_RECEIPTS,
  receiptKey,
  receiptProblem,
} from "@/domain/receipts";
import { dueDateIn, MAX_EVERY_MONTHS } from "@/domain/recurring";
import { deleteObject, objectSize, presignUpload } from "@/lib/r2";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import { getAccountBalance, getCampaignMoney, getMoneyChoices, type CampaignMoneyView, type MoneyChoices } from "./money";

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
    v.kind !== "transfer"
      ? { kind: v.kind, categoryId: v.categoryId }
      : {
            kind: "transfer",
            from: from.currency,
            to: to?.currency ?? null,
            sameAccount: v.toAccountId === v.accountId,
            toAmount: v.toAmount,
          },
  );
  if (problem) return { error: problem };

  if (v.kind !== "transfer") {
    const [category] = await db
      .select({ id: s.moneyCategories.id, kind: s.moneyCategories.kind })
      .from(s.moneyCategories)
      .where(eq(s.moneyCategories.id, v.categoryId!));
    if (!category) return { error: "That Category no longer exists." };
    if (category.kind !== v.kind) return { error: "Pick a Category." };
  }

  return {
    flow: {
      kind: v.kind,
      amount: v.amount,
      accountId: v.accountId,
      toAccountId: v.kind === "transfer" ? v.toAccountId : null,
      toAmount: v.kind === "transfer" ? (to!.currency === from.currency ? v.amount : v.toAmount) : null,
      categoryId: v.kind === "transfer" ? null : v.categoryId,
    },
  };
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

/** The Campaigns picked in the form; absent means "leave them as they are". */
const campaignIdsInput = z.array(z.uuid()).max(MAX_MOVEMENT_CAMPAIGNS).optional();

/**
 * The Campaigns a movement or a Recurring of `kind` will serve: none for a
 * Transfer (Q7), and only ones that still exist. `undefined` keeps what it had.
 */
async function checkCampaigns(
  kind: MovementKind,
  ids: string[] | undefined,
): Promise<{ error: string } | { campaignIds: string[] | undefined }> {
  if (!servesCampaigns(kind)) return { campaignIds: [] };
  if (ids === undefined) return { campaignIds: undefined };
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { campaignIds: [] };
  const found = await db.select({ id: s.campaigns.id }).from(s.campaigns).where(inArray(s.campaigns.id, unique));
  if (found.length !== unique.length) return { error: "One of those Campaigns no longer exists." };
  return { campaignIds: unique };
}

async function linkMovement(tx: Tx, movementId: string, campaignIds: string[] | undefined) {
  if (campaignIds === undefined) return;
  await tx.delete(s.moneyMovementCampaigns).where(eq(s.moneyMovementCampaigns.movementId, movementId));
  if (campaignIds.length > 0) {
    await tx.insert(s.moneyMovementCampaigns).values(campaignIds.map((campaignId) => ({ movementId, campaignId })));
  }
}

async function linkRecurring(tx: Tx, recurringId: string, campaignIds: string[] | undefined) {
  if (campaignIds === undefined) return;
  await tx.delete(s.moneyRecurringCampaigns).where(eq(s.moneyRecurringCampaigns.recurringId, recurringId));
  if (campaignIds.length > 0) {
    await tx.insert(s.moneyRecurringCampaigns).values(campaignIds.map((campaignId) => ({ recurringId, campaignId })));
  }
}

/** For a Campaign's page: the Expenses and Incomes that served it. */
export async function loadCampaignMoney(input: { campaignId: string }): Promise<CampaignMoneyView & { today: string }> {
  await requireIvan();
  const { campaignId } = z.object({ campaignId: z.uuid() }).parse(input);
  return { ...(await getCampaignMoney(campaignId)), today: today() };
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

const categoryKind = z.enum(["expense", "income"]);
type CategoryRow = { id: string; kind: "expense" | "income"; name: string };

/** Creating one that already exists (any case, same kind) gives back that one, so the "+" never makes twins. */
export async function createCategory(input: { name: string; kind?: "expense" | "income" }): Promise<CategoryRow> {
  await requireIvan();
  const v = z.object({ name, kind: categoryKind.default("expense") }).parse(input);
  const byName = and(eq(s.moneyCategories.kind, v.kind), eq(sql`lower(${s.moneyCategories.name})`, v.name.toLowerCase()));
  const picked = { id: s.moneyCategories.id, kind: s.moneyCategories.kind, name: s.moneyCategories.name };
  const [existing] = await db
    .select(picked)
    .from(s.moneyCategories)
    .where(byName)
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(s.moneyCategories)
    .values({ name: v.name, kind: v.kind })
    .onConflictDoNothing()
    .returning(picked);
  if (!created) {
    const [raced] = await db
      .select(picked)
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

/** Its movements and Recurrings move to `intoId` (same kind) and it disappears (Q7). */
export async function mergeCategory(input: { id: string; intoId: string }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), intoId: z.uuid() }).parse(input);
  if (v.id === v.intoId) return;
  await db.transaction(async (tx) => {
    const found = await tx
      .select({ id: s.moneyCategories.id, kind: s.moneyCategories.kind })
      .from(s.moneyCategories)
      .where(inArray(s.moneyCategories.id, [v.id, v.intoId]));
    if (found.length !== 2) throw new Error("That Category no longer exists.");
    if (found[0].kind !== found[1].kind) throw new Error("A Category only merges into one of the same kind (Expense or Income).");
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

const receiptKeyInput = z.string().refine(isReceiptKey, "Not a Receipt");

const movementInput = z.object({
  id: z.uuid().optional(),
  ...flowInput,
  date: isoDate,
  note,
  /** Confirming a Recurring with what really happened: it settles that month's occurrence. */
  occurrence: z.object({ recurringId: z.uuid(), month: isoMonth }).optional(),
  campaignIds: campaignIdsInput,
  /** Receipts already uploaded to attach, and attached ones to take off. */
  receipts: z
    .object({
      add: z
        .array(z.object({ key: receiptKeyInput, name: z.string().trim().min(1).max(MAX_RECEIPT_NAME), contentType: z.string() }))
        .max(MAX_RECEIPTS),
      remove: z.array(z.uuid()).max(MAX_RECEIPTS),
    })
    .optional(),
});

type ReceiptRow = Omit<typeof s.moneyReceipts.$inferInsert, "movementId">;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A signed link to upload one Receipt straight from the browser; it is attached when the movement is saved. */
export async function createReceiptUpload(input: {
  contentType: string;
  size: number;
}): Promise<{ error: string } | { key: string; uploadUrl: string }> {
  await requireIvan();
  const v = z.object({ contentType: z.string(), size: z.number().int() }).parse(input);
  const problem = receiptProblem(v);
  if (problem) return { error: problem };
  const key = receiptKey(crypto.randomUUID(), v.contentType);
  return { key, uploadUrl: await presignUpload(key) };
}

/** Uploads Ivan let go of before saving: deleted, unless a movement already holds them. */
export async function discardReceiptUploads(input: { keys: string[] }) {
  await requireIvan();
  const { keys } = z.object({ keys: z.array(receiptKeyInput).max(MAX_RECEIPTS) }).parse(input);
  if (keys.length === 0) return;
  const held = await db
    .select({ key: s.moneyReceipts.key })
    .from(s.moneyReceipts)
    .where(inArray(s.moneyReceipts.key, keys));
  const kept = new Set(held.map((r) => r.key));
  await Promise.all(keys.filter((k) => !kept.has(k)).map((k) => deleteObject(k)));
}

/** Each uploaded file is really there and is a photo or PDF of the right size. */
async function checkUploads(
  add: { key: string; name: string; contentType: string }[],
): Promise<{ error: string } | { rows: ReceiptRow[] }> {
  const rows: ReceiptRow[] = [];
  for (const file of add) {
    const size = await objectSize(file.key);
    if (size === null) return { error: `${file.name} didn't finish uploading. Attach it again.` };
    const problem = receiptProblem({ contentType: file.contentType, size });
    if (problem) {
      await deleteObject(file.key);
      return { error: `${file.name}: ${problem}` };
    }
    rows.push({ key: file.key, name: file.name, contentType: file.contentType, sizeBytes: size });
  }
  return { rows };
}

async function attach(tx: Tx, movementId: string, rows: ReceiptRow[]) {
  if (rows.length > 0) await tx.insert(s.moneyReceipts).values(rows.map((r) => ({ ...r, movementId })));
}

/** Adds a movement, or changes it when it has an `id`. Only what its kind uses is kept. */
export async function saveMovement(input: z.input<typeof movementInput>): Promise<MoneyResult> {
  await requireIvan();
  const v = movementInput.parse(input);
  const checked = await checkFlow(v);
  if ("error" in checked) return checked;
  const linked = await checkCampaigns(checked.flow.kind, v.campaignIds);
  if ("error" in linked) return linked;
  const { campaignIds } = linked;
  const row = { ...checked.flow, date: v.date, note: v.note };
  const add = v.receipts?.add ?? [];
  const remove = v.receipts?.remove ?? [];

  if (add.length > 0) {
    const [held] = v.id
      ? await db.select({ n: count() }).from(s.moneyReceipts).where(eq(s.moneyReceipts.movementId, v.id))
      : [{ n: 0 }];
    if (held.n - remove.length + add.length > MAX_RECEIPTS) return { error: `Up to ${MAX_RECEIPTS} Receipts each.` };
  }
  const uploads = await checkUploads(add);
  if ("error" in uploads) return uploads;

  let removed: { key: string }[] = [];
  if (v.id) {
    const id = v.id;
    await db.transaction(async (tx) => {
      await tx.update(s.moneyMovements).set(row).where(eq(s.moneyMovements.id, id));
      await linkMovement(tx, id, campaignIds);
      await attach(tx, id, uploads.rows);
      if (remove.length > 0) {
        removed = await tx
          .delete(s.moneyReceipts)
          .where(and(eq(s.moneyReceipts.movementId, id), inArray(s.moneyReceipts.id, remove)))
          .returning({ key: s.moneyReceipts.key });
      }
    });
  } else if (v.occurrence) {
    const settled = await settle(v.occurrence.recurringId, v.occurrence.month, row, uploads.rows, campaignIds ?? []);
    if (settled) return settled;
  } else {
    await db.transaction(async (tx) => {
      const [movement] = await tx.insert(s.moneyMovements).values(row).returning({ id: s.moneyMovements.id });
      await linkMovement(tx, movement.id, campaignIds ?? []);
      await attach(tx, movement.id, uploads.rows);
    });
  }
  await Promise.all(removed.map((r) => deleteObject(r.key)));
  await done();
  return null;
}

/** Records `row` and marks the occurrence as confirmed by it, both or neither. */
async function settle(
  recurringId: string,
  month: string,
  row: typeof s.moneyMovements.$inferInsert,
  receipts: ReceiptRow[] = [],
  campaignIds: string[] = [],
): Promise<MoneyResult> {
  try {
    await db.transaction(async (tx) => {
      const [movement] = await tx.insert(s.moneyMovements).values(row).returning({ id: s.moneyMovements.id });
      await tx.insert(s.moneyRecurringOccurrences).values({ recurringId, month, movementId: movement.id });
      await linkMovement(tx, movement.id, campaignIds);
      await attach(tx, movement.id, receipts);
    });
  } catch (error) {
    if (isUniqueClash(error)) return { error: "That one is already settled." };
    throw error;
  }
  return null;
}

/** Deleting what a Recurring recorded makes that occurrence pending again. Its Receipts go too. */
export async function deleteMovement(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  const receipts = await db
    .select({ key: s.moneyReceipts.key })
    .from(s.moneyReceipts)
    .where(eq(s.moneyReceipts.movementId, id));
  await db.delete(s.moneyMovements).where(eq(s.moneyMovements.id, id));
  await Promise.all(receipts.map((r) => deleteObject(r.key)));
  await done();
}

// ─── Recurrings ──────────────────────────────────────────────────────────────

const recurringInput = z.object({
  id: z.uuid().optional(),
  name,
  ...flowInput,
  firstDate: isoDate,
  everyMonths: z.number().int().min(1).max(MAX_EVERY_MONTHS),
  campaignIds: campaignIdsInput,
});

/** Creates a Recurring or changes it; a change applies to the occurrences still to settle. */
export async function saveRecurring(input: z.input<typeof recurringInput>): Promise<MoneyResult> {
  await requireIvan();
  const v = recurringInput.parse(input);
  const checked = await checkFlow(v);
  if ("error" in checked) return checked;
  const linked = await checkCampaigns(checked.flow.kind, v.campaignIds);
  if ("error" in linked) return linked;
  const row = { ...checked.flow, name: v.name, firstDate: v.firstDate, everyMonths: v.everyMonths };
  await db.transaction(async (tx) => {
    if (v.id) {
      await tx.update(s.moneyRecurrings).set(row).where(eq(s.moneyRecurrings.id, v.id));
      await linkRecurring(tx, v.id, linked.campaignIds);
    } else {
      const [created] = await tx.insert(s.moneyRecurrings).values(row).returning({ id: s.moneyRecurrings.id });
      await linkRecurring(tx, created.id, linked.campaignIds ?? []);
    }
  });
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
  // The occurrence takes the Campaigns its Recurring carries (Q7).
  const carried = await db
    .select({ campaignId: s.moneyRecurringCampaigns.campaignId })
    .from(s.moneyRecurringCampaigns)
    .where(eq(s.moneyRecurringCampaigns.recurringId, rule.id));
  const settled = await settle(rule.id, v.month, {
    kind: rule.kind,
    amount: rule.amount,
    accountId: rule.accountId,
    toAccountId: rule.toAccountId,
    toAmount: rule.toAmount,
    categoryId: rule.categoryId,
    date: due,
    note: rule.name,
  }, [], servesCampaigns(rule.kind) ? carried.map((c) => c.campaignId) : []);
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
