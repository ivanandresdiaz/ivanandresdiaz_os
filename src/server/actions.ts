"use server";

import { and, asc, eq, gt, inArray, isNull, max, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { closeAt } from "@/domain/cycles";
import { addDays, isIsoDate, localMoment, parseMinutes, type QuarterRef } from "@/domain/dates";
import {
  type CoachReview,
  dictationExtension,
  dictationKey,
  isDictationKey,
  MAX_COACH_CHARS,
  MAX_DICTATION_BYTES,
} from "@/domain/english";
import { MAX_DAILY_LIKES } from "@/domain/feed";
import { validateNewHighlight } from "@/domain/highlights";
import { normalizeGames } from "@/domain/infinite-games";
import { MAX_DESCRIPTION, MAX_LINK_TITLE, MAX_LINK_URL, normalizeLinkUrl } from "@/domain/links";
import { MAX_REFERENCE_TITLE, referenceKey, referencePrefix, validateReferenceFile } from "@/domain/references";
import { parseQuarterKey } from "@/domain/plan";
import { isFeltScore, openReview } from "@/domain/reviews";
import { dayAfterScheduling } from "@/domain/secondary-tasks";
import { DAY_END_MIN, MIN_SLOT_MIN } from "@/domain/slots";
import { isReminderLead, slotStarted } from "@/domain/reminders";
import { isValidInterval, monthMove, nextUpkeepDay } from "@/domain/upkeeps";
import {
  type DayBlockChange,
  type DayBlockRef,
  isDayEditable,
  planDayBlockChange,
  planStructureEdit,
  planStructureRemoval,
  type StructureBlock,
} from "@/domain/structure";
import { aiAvailability, CoachError, reviewEnglish, transcribe } from "@/lib/ai";
import { deleteObject, getObject, objectSize, presignUpload } from "@/lib/r2";
import { requireIvan } from "@/lib/session";
import { APP_TIMEZONE, today } from "@/lib/today";
import { isConnected } from "./google-calendar";
import { getMovesChosenFor } from "./queries";
import { retryFailedReminders, syncDeletions, syncSlots, syncWork } from "./reminders";

const isoDate = z.string().refine(isIsoDate, "Invalid date");
const minute = z.coerce.number().int().min(0).max(DAY_END_MIN);
const hhmm = z.string().transform((v) => parseMinutes(v));
const text = z.string().trim();
const MAX_LEARNING_ENTRY = 1_000;
const required = z.string().trim().min(1);
const optionalId = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());

function fields(fd: FormData) {
  return Object.fromEntries([...fd.keys()].map((key) => [key, fd.get(key)]));
}

function games(fd: FormData) {
  return normalizeGames(fd.getAll("games").map(String));
}

function timeRange<T extends { startMin: number; endMin: number }>(value: T): T {
  if (value.endMin - value.startMin < MIN_SLOT_MIN) {
    throw new Error("End must be after start");
  }
  return value;
}

async function done() {
  refresh();
}

// ─── Long text: Dictation and English Coach ──────────────────────────────────
// They answer { ok: false, error } instead of throwing, because production
// hides the message of a thrown error and these failures are worth reading.

type Outcome<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Signs a one-off upload for a recording; the browser sends it straight to R2. */
export async function createDictationUpload(input: {
  contentType: string;
  size: number;
}): Promise<Outcome<{ key: string; uploadUrl: string }>> {
  await requireIvan();
  if (!aiAvailability().dictation) return { ok: false, error: "Set OPENAI_API_KEY to dictate." };
  const v = z.object({ contentType: z.string(), size: z.number().int().positive() }).parse(input);
  const extension = dictationExtension(v.contentType);
  if (!extension) return { ok: false, error: `This browser records ${v.contentType}, which cannot be transcribed.` };
  if (v.size > MAX_DICTATION_BYTES) return { ok: false, error: "The recording is too large to transcribe." };
  const key = dictationKey(crypto.randomUUID(), extension);
  return { ok: true, key, uploadUrl: await presignUpload(key) };
}

/**
 * Transcribes an uploaded recording and deletes it. When transcription fails the
 * recording stays, so it can be retried; R2 clears what is left after a day.
 */
export async function transcribeDictation(input: { key: string; contentType: string }): Promise<Outcome<{ text: string }>> {
  await requireIvan();
  const { key, contentType } = z.object({ key: z.string(), contentType: z.string() }).parse(input);
  if (!isDictationKey(key)) throw new Error("Not a Dictation recording");
  const audio = await getObject(key);
  if (!audio) return { ok: false, error: "The recording is gone. Dictate again." };
  try {
    const text = await transcribe(audio, key.slice(key.lastIndexOf("/") + 1), contentType.split(";")[0]);
    await deleteObject(key);
    return { ok: true, text };
  } catch (error) {
    console.error("Dictation failed", error);
    return { ok: false, error: "Transcription failed." };
  }
}

export async function discardDictation(input: { key: string }) {
  await requireIvan();
  const { key } = z.object({ key: z.string() }).parse(input);
  if (!isDictationKey(key)) throw new Error("Not a Dictation recording");
  await deleteObject(key);
}

/** The English Coach's review of a Long text. Nothing is saved. */
export async function coachEnglish(input: { text: string; markdown: boolean }): Promise<Outcome<{ review: CoachReview }>> {
  await requireIvan();
  if (!aiAvailability().coach) return { ok: false, error: "Set ANTHROPIC_API_KEY to use the Coach." };
  const { text, markdown } = z.object({ text: z.string(), markdown: z.boolean() }).parse(input);
  if (!text.trim()) return { ok: false, error: "Write something first." };
  if (text.length > MAX_COACH_CHARS) return { ok: false, error: "The text is too long for one review." };
  try {
    return { ok: true, review: await reviewEnglish(text, markdown) };
  } catch (error) {
    if (error instanceof CoachError) return { ok: false, error: error.message };
    console.error("English Coach failed", error);
    return { ok: false, error: "The Coach could not answer. Try again." };
  }
}

// ─── Feed ────────────────────────────────────────────────────────────────────

/** One more Like (+1, up to 5 a day) or one fewer (-1, only from today's) for a Reference. */
export async function likeReference(input: { referenceId: string; delta: 1 | -1 }) {
  await requireIvan();
  const { referenceId, delta } = z
    .object({ referenceId: z.uuid(), delta: z.union([z.literal(1), z.literal(-1)]) })
    .parse(input);
  const date = today();
  const todays = and(eq(s.referenceLikes.referenceId, referenceId), eq(s.referenceLikes.date, date));
  if (delta === 1) {
    const [reference] = await db
      .select({ id: s.principleReferences.id })
      .from(s.principleReferences)
      .where(eq(s.principleReferences.id, referenceId));
    if (!reference) return;
    await db
      .insert(s.referenceLikes)
      .values({ referenceId, date })
      .onConflictDoUpdate({
        target: [s.referenceLikes.referenceId, s.referenceLikes.date],
        set: { count: sql`least(${s.referenceLikes.count} + 1, ${MAX_DAILY_LIKES})` },
      });
  } else {
    const left = await db
      .update(s.referenceLikes)
      .set({ count: sql`${s.referenceLikes.count} - 1` })
      .where(and(todays, gt(s.referenceLikes.count, 1)))
      .returning({ id: s.referenceLikes.id });
    if (left.length === 0) await db.delete(s.referenceLikes).where(todays);
  }
  await done();
}

/**
 * Remembers where Ivan is in today's Feed. Not refreshed: the screen already
 * shows it, and re-rendering would interrupt the playing Reference.
 */
export async function saveFeedPosition(input: { position: number }) {
  await requireIvan();
  const { position } = z.object({ position: z.number().int().min(0) }).parse(input);
  await db
    .update(s.feeds)
    .set({
      position,
      seen: sql`greatest(${s.feeds.seen}, least(${position + 1}, cardinality(${s.feeds.referenceIds})))`,
    })
    .where(eq(s.feeds.date, today()));
}

// ─── Principles ──────────────────────────────────────────────────────────────

export async function createPrinciple(fd: FormData) {
  await requireIvan();
  const { title, body } = z.object({ title: required, body: text }).parse(fields(fd));
  const [{ last }] = await db.select({ last: max(s.principles.position) }).from(s.principles);
  await db.insert(s.principles).values({ title, body, position: (last ?? -1) + 1 });
  await done();
}

export async function updatePrinciple(fd: FormData) {
  await requireIvan();
  const { id, title, body } = z
    .object({ id: z.uuid(), title: required, body: text })
    .parse(fields(fd));
  await db.update(s.principles).set({ title, body }).where(eq(s.principles.id, id));
  await done();
}

export async function deletePrinciple(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  const references = await db
    .select({ key: s.principleReferences.key })
    .from(s.principleReferences)
    .where(eq(s.principleReferences.principleId, id));
  await Promise.all(references.map((r) => deleteObject(r.key)));
  await db.delete(s.principles).where(eq(s.principles.id, id));
  await done();
}

// ─── Principle References ────────────────────────────────────────────────────

const referenceFile = z.object({
  principleId: z.uuid(),
  contentType: z.string(),
  size: z.number().int(),
});

/** Signs a one-off upload URL; the browser sends the file straight to R2. */
export async function createReferenceUpload(input: { principleId: string; contentType: string; size: number }) {
  await requireIvan();
  const v = referenceFile.parse(input);
  const problem = validateReferenceFile(v);
  if (problem) throw new Error(`Cannot add Reference: ${problem}`);
  const [principle] = await db
    .select({ id: s.principles.id })
    .from(s.principles)
    .where(eq(s.principles.id, v.principleId));
  if (!principle) throw new Error("Principle not found");
  const key = referenceKey(v.principleId, crypto.randomUUID(), v.contentType);
  return { key, uploadUrl: await presignUpload(key) };
}

const referenceTitle = z
  .string()
  .trim()
  .max(MAX_REFERENCE_TITLE)
  .transform((v) => v || null);

/** Records a Reference once its file is in R2. */
export async function confirmReferenceUpload(input: {
  principleId: string;
  key: string;
  contentType: string;
  title: string;
}) {
  await requireIvan();
  const v = z
    .object({
      principleId: z.uuid(),
      key: z.string().regex(/^[\w/.-]+$/),
      contentType: z.string(),
      title: referenceTitle,
    })
    .parse(input);
  if (!v.key.startsWith(referencePrefix(v.principleId))) throw new Error("Key outside the Principle");
  const size = await objectSize(v.key);
  if (size === null) throw new Error("The upload did not reach storage");
  const problem = validateReferenceFile({ contentType: v.contentType, size });
  if (problem) {
    await deleteObject(v.key);
    throw new Error(`Cannot add Reference: ${problem}`);
  }
  const [{ last }] = await db
    .select({ last: max(s.principleReferences.position) })
    .from(s.principleReferences)
    .where(eq(s.principleReferences.principleId, v.principleId));
  await db
    .insert(s.principleReferences)
    .values({
      principleId: v.principleId,
      key: v.key,
      contentType: v.contentType,
      title: v.title,
      sizeBytes: size,
      position: (last ?? -1) + 1,
    })
    .onConflictDoNothing();
  await done();
}

export async function renameReference(input: { id: string; title: string }) {
  await requireIvan();
  const { id, title } = z.object({ id: z.uuid(), title: referenceTitle.pipe(z.string()) }).parse(input);
  await db.update(s.principleReferences).set({ title }).where(eq(s.principleReferences.id, id));
  await done();
}

export async function deleteReference(input: { id: string }) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(input);
  const [reference] = await db.select().from(s.principleReferences).where(eq(s.principleReferences.id, id));
  if (!reference) return;
  await deleteObject(reference.key);
  await db.delete(s.principleReferences).where(eq(s.principleReferences.id, id));
  await done();
}

export async function reorderReferences(input: { principleId: string; ids: string[] }) {
  await requireIvan();
  const { principleId, ids } = z.object({ principleId: z.uuid(), ids: z.array(z.uuid()) }).parse(input);
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx
        .update(s.principleReferences)
        .set({ position })
        .where(and(eq(s.principleReferences.id, id), eq(s.principleReferences.principleId, principleId)));
    }
  });
  await done();
}

/** Saves the order Ivan dragged the Principles into; `ids` must list every Principle. */
export async function reorderPrinciples(input: { ids: string[] }) {
  await requireIvan();
  const { ids } = z.object({ ids: z.array(z.uuid()) }).parse(input);
  const existing = await db.select({ id: s.principles.id }).from(s.principles);
  const known = new Set(existing.map((p) => p.id));
  if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) return;
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(s.principles).set({ position }).where(eq(s.principles.id, id));
    }
  });
  await done();
}

// ─── Season ──────────────────────────────────────────────────────────────────

export async function updateSeason(fd: FormData) {
  await requireIvan();
  const { id, title, body } = z
    .object({ id: z.uuid(), title: required, body: text })
    .parse(fields(fd));
  await db.update(s.seasons).set({ title, body }).where(eq(s.seasons.id, id));
  await done();
}

/** Opening a new Season closes the current one: there is always exactly one. */
export async function startSeason(fd: FormData) {
  await requireIvan();
  const { title } = z.object({ title: required }).parse(fields(fd));
  const now = today();
  await db.transaction(async (tx) => {
    await tx
      .update(s.seasons)
      .set({ endedOn: addDays(now, -1) })
      .where(isNull(s.seasons.endedOn));
    await tx.insert(s.seasons).values({ title, startedOn: now });
  });
  await done();
}

export async function addSeasonGoal(fd: FormData) {
  await requireIvan();
  const { seasonId, title } = z
    .object({ seasonId: z.uuid(), title: required })
    .parse(fields(fd));
  const [{ last }] = await db
    .select({ last: max(s.seasonGoals.position) })
    .from(s.seasonGoals)
    .where(eq(s.seasonGoals.seasonId, seasonId));
  await db.insert(s.seasonGoals).values({ seasonId, title, position: (last ?? -1) + 1 });
  await done();
}

export async function updateSeasonGoal(fd: FormData) {
  await requireIvan();
  const { id, title } = z.object({ id: z.uuid(), title: required }).parse(fields(fd));
  await db.update(s.seasonGoals).set({ title }).where(eq(s.seasonGoals.id, id));
  await done();
}

export async function deleteSeasonGoal(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.seasonGoals).where(eq(s.seasonGoals.id, id));
  await done();
}

// ─── Quarter ─────────────────────────────────────────────────────────────────

export async function saveQuarter(fd: FormData) {
  await requireIvan();
  const { year, quarter, title, body } = z
    .object({
      year: z.coerce.number().int().min(2000).max(2100),
      quarter: z.coerce.number().int().min(1).max(4),
      title: text,
      body: text,
    })
    .parse(fields(fd));
  await db
    .insert(s.quarters)
    .values({ year, quarter, title, body })
    .onConflictDoUpdate({
      target: [s.quarters.year, s.quarters.quarter],
      set: { title, body },
    });
  await done();
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

const campaignFields = z.object({
  title: required,
  goal: text,
  why: text,
  antiGoal: text,
  seasonGoalId: optionalId,
  blockTypeId: optionalId,
});

/** "2026-Q4", or nothing. */
const quarterKeyField = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const ref = parseQuarterKey(v);
    if (!ref) ctx.addIssue({ code: "custom", message: "Invalid Quarter" });
    return ref;
  });

/** A Quarter exists once it holds something: writing in it or giving it a Campaign creates it. */
async function ensureQuarter(tx: Tx, ref: QuarterRef): Promise<string> {
  await tx.insert(s.quarters).values(ref).onConflictDoNothing();
  const [row] = await tx
    .select({ id: s.quarters.id })
    .from(s.quarters)
    .where(and(eq(s.quarters.year, ref.year), eq(s.quarters.quarter, ref.quarter)));
  return row.id;
}

/** The place after the last Campaign of a Quarter, or of the Backlog's candidates. */
async function lastPriority(tx: Tx, quarterId: string | null): Promise<number> {
  const [{ last }] = await tx
    .select({ last: max(s.campaigns.position) })
    .from(s.campaigns)
    .where(quarterId ? eq(s.campaigns.quarterId, quarterId) : eq(s.campaigns.status, "candidate"));
  return (last ?? -1) + 1;
}

/** Only the title: the GPS, Season Goal, Block and Infinite Games are written in the Campaign's drawer. */
export async function createCampaign(fd: FormData) {
  await requireIvan();
  const { title, quarter } = z.object({ title: required, quarter: quarterKeyField }).parse(fields(fd));
  const id = await db.transaction(async (tx) => {
    const quarterId = quarter ? await ensureQuarter(tx, quarter) : null;
    const [campaign] = await tx
      .insert(s.campaigns)
      .values({
        title,
        quarterId,
        status: quarterId ? "active" : "candidate",
        position: await lastPriority(tx, quarterId),
      })
      .returning({ id: s.campaigns.id });
    return campaign.id;
  });
  // It opens in the Plan, next to its Quarter, to write its GPS there.
  redirect(`/os/plan?${quarter ? `q=${quarter.year}-Q${quarter.quarter}&` : ""}campaign=${id}&col=campaign`);
}

/** Saves the priority Ivan dragged a Quarter's open Campaigns (or the candidates) into. */
export async function reorderCampaigns(input: { ids: string[] }) {
  await requireIvan();
  const { ids } = z.object({ ids: z.array(z.uuid()).min(1) }).parse(input);
  const rows = await db
    .select({ id: s.campaigns.id, quarterId: s.campaigns.quarterId, status: s.campaigns.status })
    .from(s.campaigns)
    .where(inArray(s.campaigns.id, ids));
  const sameList =
    rows.length === ids.length &&
    new Set(ids).size === ids.length &&
    rows.every((r) => r.quarterId === rows[0].quarterId && (r.status === "active" || r.status === "candidate"));
  if (!sameList) return;
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(s.campaigns).set({ position }).where(eq(s.campaigns.id, id));
    }
  });
  await done();
}

export async function updateCampaign(fd: FormData) {
  await requireIvan();
  const { id, ...values } = campaignFields.extend({ id: z.uuid() }).parse(fields(fd));
  await db
    .update(s.campaigns)
    .set({ ...values, games: games(fd) })
    .where(eq(s.campaigns.id, id));
  await done();
}

/** Activating a candidate, or reactivating a closed Campaign, puts it last in its Quarter's priority. */
export async function setCampaignStatus(fd: FormData) {
  await requireIvan();
  const { id, status, quarter } = z
    .object({
      id: z.uuid(),
      status: z.enum(["candidate", "active", "done", "dropped"]),
      quarter: quarterKeyField,
    })
    .parse(fields(fd));
  await db.transaction(async (tx) => {
    const [campaign] = await tx
      .select({ quarterId: s.campaigns.quarterId, status: s.campaigns.status })
      .from(s.campaigns)
      .where(eq(s.campaigns.id, id));
    if (!campaign) return;
    const quarterId = quarter ? await ensureQuarter(tx, quarter) : campaign.quarterId;
    await tx
      .update(s.campaigns)
      .set({
        status,
        quarterId,
        ...(status === "active" && quarterId ? { position: await lastPriority(tx, quarterId) } : {}),
      })
      .where(eq(s.campaigns.id, id));
    // An idea that starts being played: its Moves get their week in the Weekly Review, not before.
    if (campaign.status === "candidate" && status === "active") {
      await tx.update(s.moves).set({ weekOf: null }).where(eq(s.moves.campaignId, id));
    }
  });
  await done();
}

export async function deleteCampaign(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.campaigns).where(eq(s.campaigns.id, id));
  await syncDeletions();
  redirect("/os/plan");
}

// ─── Moves, Tasks, Steps ─────────────────────────────────────────────────────

export async function createMove(fd: FormData) {
  await requireIvan();
  const { campaignId, title, weekOf } = z
    .object({
      campaignId: z.uuid(),
      title: required,
      weekOf: isoDate.optional().or(z.literal("").transform(() => undefined)),
    })
    .parse(fields(fd));
  // A new Move goes last in its Campaign's priority.
  const [[{ last }], [campaign]] = await Promise.all([
    db.select({ last: max(s.moves.position) }).from(s.moves).where(eq(s.moves.campaignId, campaignId)),
    db.select({ status: s.campaigns.status }).from(s.campaigns).where(eq(s.campaigns.id, campaignId)),
  ]);
  if (!campaign) return;
  // Only a Campaign being played takes a week; a candidate's Moves wait for it to be activated.
  const week = campaign.status === "active" ? (weekOf ?? null) : null;
  await db.insert(s.moves).values({ campaignId, title, weekOf: week, position: (last ?? -1) + 1 });
  await done();
}

/** Saves the priority Ivan dragged a Campaign's open Moves into. */
export async function reorderMoves(input: { ids: string[] }) {
  await requireIvan();
  const { ids } = z.object({ ids: z.array(z.uuid()).min(1) }).parse(input);
  const rows = await db
    .select({ id: s.moves.id, campaignId: s.moves.campaignId })
    .from(s.moves)
    .where(inArray(s.moves.id, ids));
  const sameCampaign =
    rows.length === ids.length && new Set(ids).size === ids.length && rows.every((r) => r.campaignId === rows[0].campaignId);
  if (!sameCampaign) return;
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(s.moves).set({ position }).where(eq(s.moves.id, id));
    }
  });
  await done();
}

export async function updateMove(fd: FormData) {
  await requireIvan();
  const { id, title } = z.object({ id: z.uuid(), title: required }).parse(fields(fd));
  await db.update(s.moves).set({ title }).where(eq(s.moves.id, id));
  await syncWork("move", [id]);
  await done();
}

/** Choose a Move for a week (Weekly Review) or send it back (empty weekOf). */
export async function setMoveWeek(fd: FormData) {
  await requireIvan();
  const { id, weekOf } = z
    .object({ id: z.uuid(), weekOf: isoDate.or(z.literal("").transform(() => null)) })
    .parse(fields(fd));
  if (weekOf !== null) {
    // Only a Move of a Campaign being played is chosen for a week.
    const [row] = await db
      .select({ status: s.campaigns.status })
      .from(s.moves)
      .innerJoin(s.campaigns, eq(s.moves.campaignId, s.campaigns.id))
      .where(eq(s.moves.id, id));
    // Refused: the page refreshes to show why (the Move no longer offers a week).
    if (row?.status !== "active") return done();
  }
  await db.update(s.moves).set({ weekOf }).where(eq(s.moves.id, id));
  await done();
}

export async function deleteMove(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.moves).where(eq(s.moves.id, id));
  await syncDeletions();
  await done();
}

export async function createTask(fd: FormData) {
  await requireIvan();
  const { moveId, title, durationMin } = z
    .object({
      moveId: optionalId,
      title: required,
      durationMin: z.coerce.number().int().min(MIN_SLOT_MIN).max(DAY_END_MIN).default(60),
    })
    .parse(fields(fd));
  // It joins last: in its Move, or among the Loose Tasks.
  const [{ last }] = await db
    .select({ last: max(s.tasks.position) })
    .from(s.tasks)
    .where(moveId ? eq(s.tasks.moveId, moveId) : isNull(s.tasks.moveId));
  await db.insert(s.tasks).values({ moveId, title, durationMin, games: games(fd), position: (last ?? -1) + 1 });
  await done();
}

/** Saves the priority Ivan dragged a Move's open Tasks (or the open Loose Tasks) into. */
export async function reorderTasks(input: { ids: string[] }) {
  await requireIvan();
  const { ids } = z.object({ ids: z.array(z.uuid()).min(1) }).parse(input);
  const rows = await db
    .select({ id: s.tasks.id, moveId: s.tasks.moveId })
    .from(s.tasks)
    .where(inArray(s.tasks.id, ids));
  const sameList =
    rows.length === ids.length && new Set(ids).size === ids.length && rows.every((r) => r.moveId === rows[0].moveId);
  if (!sameList) return;
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(s.tasks).set({ position }).where(eq(s.tasks.id, id));
    }
  });
  await done();
}

export async function updateTask(fd: FormData) {
  await requireIvan();
  // Only the title: a Task's length is set in the calendar.
  const { id, title } = z.object({ id: z.uuid(), title: required }).parse(fields(fd));
  await db.update(s.tasks).set({ title }).where(eq(s.tasks.id, id));
  await syncWork("task", [id]);
  await done();
}

export async function deleteTask(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.tasks).where(eq(s.tasks.id, id));
  await syncDeletions();
  await done();
}

export async function createStep(fd: FormData) {
  await requireIvan();
  const { taskId, title } = z.object({ taskId: z.uuid(), title: required }).parse(fields(fd));
  const [{ last }] = await db
    .select({ last: max(s.steps.position) })
    .from(s.steps)
    .where(eq(s.steps.taskId, taskId));
  await db.insert(s.steps).values({ taskId, title, position: (last ?? -1) + 1 });
  await done();
}

/** Saves the order Ivan dragged a Task's Steps into. */
export async function reorderSteps(input: { ids: string[] }) {
  await requireIvan();
  const { ids } = z.object({ ids: z.array(z.uuid()).min(1) }).parse(input);
  const rows = await db
    .select({ id: s.steps.id, taskId: s.steps.taskId })
    .from(s.steps)
    .where(inArray(s.steps.id, ids));
  const sameTask =
    rows.length === ids.length && new Set(ids).size === ids.length && rows.every((r) => r.taskId === rows[0].taskId);
  if (!sameTask) return;
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(s.steps).set({ position }).where(eq(s.steps.id, id));
    }
  });
  await done();
}

export async function toggleStep(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db
    .update(s.steps)
    .set({ done: sql`not ${s.steps.done}` })
    .where(eq(s.steps.id, id));
  await done();
}

export async function deleteStep(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.steps).where(eq(s.steps.id, id));
  await done();
}

// ─── Description and Links of a Task or a Move ───────────────────────────────

const detailOwner = z.object({ kind: z.enum(["task", "move"]), id: z.uuid() });

/** Saves the Description of a Task or a Move; empty removes it. */
export async function setDescription(input: { kind: "task" | "move"; id: string; description: string }) {
  await requireIvan();
  const { kind, id, description } = detailOwner
    .extend({ description: z.string().trim().max(MAX_DESCRIPTION) })
    .parse(input);
  const table = kind === "task" ? s.tasks : s.moves;
  await db.update(table).set({ description }).where(eq(table.id, id));
  await done();
}

const linkFields = z.object({
  url: z.string().max(MAX_LINK_URL),
  title: z.string().trim().max(MAX_LINK_TITLE).default(""),
});

/** Adds a Link at the end. An address that is not a web page is refused, with a reason to show. */
export async function createLink(input: {
  kind: "task" | "move";
  id: string;
  url: string;
  title?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireIvan();
  const { kind, id, title, ...rest } = detailOwner.extend(linkFields.shape).parse(input);
  const url = normalizeLinkUrl(rest.url);
  if (!url) return { ok: false, error: "That is not a web address." };
  const owner = kind === "task" ? s.links.taskId : s.links.moveId;
  const [{ last }] = await db.select({ last: max(s.links.position) }).from(s.links).where(eq(owner, id));
  await db.insert(s.links).values({
    taskId: kind === "task" ? id : null,
    moveId: kind === "move" ? id : null,
    url,
    title,
    position: (last ?? -1) + 1,
  });
  await done();
  return { ok: true };
}

export async function updateLink(input: {
  id: string;
  url: string;
  title?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireIvan();
  const { id, title, ...rest } = linkFields.extend({ id: z.uuid() }).parse(input);
  const url = normalizeLinkUrl(rest.url);
  if (!url) return { ok: false, error: "That is not a web address." };
  await db.update(s.links).set({ url, title }).where(eq(s.links.id, id));
  await done();
  return { ok: true };
}

export async function deleteLink(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.links).where(eq(s.links.id, id));
  await done();
}

/** Saves the order Ivan put the Links of one Task or Move in. */
export async function reorderLinks(input: { ids: string[] }) {
  await requireIvan();
  const { ids } = z.object({ ids: z.array(z.uuid()).min(1) }).parse(input);
  const rows = await db
    .select({ taskId: s.links.taskId, moveId: s.links.moveId })
    .from(s.links)
    .where(inArray(s.links.id, ids));
  const sameOwner =
    rows.length === ids.length &&
    new Set(ids).size === ids.length &&
    rows.every((r) => r.taskId === rows[0].taskId && r.moveId === rows[0].moveId);
  if (!sameOwner) return;
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(s.links).set({ position }).where(eq(s.links.id, id));
    }
  });
  await done();
}

const workRef = z.object({ kind: z.enum(["task", "move", "secondary"]), id: z.uuid() });
const strategicWorkRef = z.object({ kind: z.enum(["task", "move"]), id: z.uuid() });

/** Marks calendar work done. Strategic work also synchronizes its linked Highlights. */
export async function toggleWorkDone(input: { kind: "task" | "move" | "secondary"; id: string }) {
  await requireIvan();
  const { kind, id } = workRef.parse(input);
  const table = kind === "task" ? s.tasks : kind === "move" ? s.moves : s.secondaryTasks;
  const [row] = await db.select({ doneAt: table.doneAt }).from(table).where(eq(table.id, id));
  if (!row) return;
  const nowDone = row.doneAt === null;
  await db.transaction(async (tx) => {
    await tx
      .update(table)
      .set({ doneAt: nowDone ? new Date() : null })
      .where(eq(table.id, id));
    if (kind === "secondary") {
      await settleUpkeep(tx, id, nowDone);
    } else {
      await tx
        .update(s.highlights)
        .set({ done: nowDone })
        .where(kind === "task" ? eq(s.highlights.taskId, id) : eq(s.highlights.moveId, id));
    }
  });
  // Done: its Reminders go away. Reopened: they come back.
  await syncWork(kind, [id]);
  await done();
}

export async function toggleWorkDoneForm(fd: FormData) {
  await toggleWorkDone(workRef.parse(fields(fd)));
}

// ─── Block types & Structure ─────────────────────────────────────────────────

export async function createBlockType(fd: FormData) {
  await requireIvan();
  const values = z
    .object({
      name: required,
      kind: z.enum(["habit", "container"]),
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
    })
    .parse(fields(fd));
  await db.insert(s.blockTypes).values({ ...values, games: games(fd) });
  await done();
}

export async function updateBlockType(fd: FormData) {
  await requireIvan();
  const { id, ...values } = z
    .object({
      id: z.uuid(),
      name: required,
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
    })
    .parse(fields(fd));
  await db
    .update(s.blockTypes)
    .set({ ...values, games: games(fd) })
    .where(eq(s.blockTypes.id, id));
  await done();
}

export async function setBlockTypeArchived(fd: FormData) {
  await requireIvan();
  const { id, archived } = z
    .object({ id: z.uuid(), archived: z.enum(["true", "false"]).transform((v) => v === "true") })
    .parse(fields(fd));
  await db.update(s.blockTypes).set({ archived }).where(eq(s.blockTypes.id, id));
  await done();
}

/** One independent Block per weekday, all with the same times and Block type. */
export async function addStructureBlocks(input: {
  weekdays: number[];
  startMin: number;
  endMin: number;
  blockTypeId: string;
}) {
  await requireIvan();
  const { weekdays, ...values } = z
    .object({
      weekdays: z.array(z.number().int().min(1).max(7)).min(1),
      startMin: minute,
      endMin: minute,
      blockTypeId: z.uuid(),
    })
    .parse(input);
  timeRange(values);
  const validFrom = today();
  await db
    .insert(s.structureBlocks)
    .values([...new Set(weekdays)].map((weekday) => ({ ...values, weekday, validFrom })));
  await done();
}

async function loadStructureBlock(id: string): Promise<StructureBlock> {
  const [row] = await db.select().from(s.structureBlocks).where(eq(s.structureBlocks.id, id));
  if (!row) throw new Error("Block not found");
  return { ...row, weekday: row.weekday as StructureBlock["weekday"] };
}

/** Changing the Structure applies from today onward; past days keep their history. */
export async function editStructureBlock(input: {
  id: string;
  weekday?: number;
  startMin?: number;
  endMin?: number;
  blockTypeId?: string;
}) {
  await requireIvan();
  const { id, ...change } = z
    .object({
      id: z.uuid(),
      weekday: z.number().int().min(1).max(7).optional(),
      startMin: minute.optional(),
      endMin: minute.optional(),
      blockTypeId: z.uuid().optional(),
    })
    .parse(input);
  const block = await loadStructureBlock(id);
  timeRange({
    startMin: change.startMin ?? block.startMin,
    endMin: change.endMin ?? block.endMin,
  });
  const plan = planStructureEdit(
    block,
    { ...change, weekday: change.weekday as StructureBlock["weekday"] | undefined },
    today(),
  );
  if (plan.kind === "update") {
    await db.update(s.structureBlocks).set(plan.values).where(eq(s.structureBlocks.id, plan.id));
  } else {
    await db.transaction(async (tx) => {
      await tx
        .update(s.structureBlocks)
        .set({ validTo: plan.close.validTo })
        .where(eq(s.structureBlocks.id, plan.close.id));
      await tx.insert(s.structureBlocks).values(plan.insert);
    });
  }
  await done();
}

export async function editStructureBlockForm(fd: FormData) {
  const { id, startMin, endMin, blockTypeId } = z
    .object({ id: z.uuid(), startMin: hhmm, endMin: hhmm, blockTypeId: z.uuid() })
    .parse(fields(fd));
  await editStructureBlock({ id, startMin, endMin, blockTypeId });
}

export async function removeStructureBlock(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  const plan = planStructureRemoval(await loadStructureBlock(id), today());
  if (plan.kind === "delete") {
    await db.delete(s.structureBlocks).where(eq(s.structureBlocks.id, plan.id));
  } else {
    await db
      .update(s.structureBlocks)
      .set({ validTo: plan.validTo })
      .where(eq(s.structureBlocks.id, plan.id));
  }
  await done();
}

// ─── Exceptions ──────────────────────────────────────────────────────────────
// They change one date's Blocks without touching the Structure, and only for
// today or later (isDayEditable).

function editableDay(date: string) {
  if (!isDayEditable(date, today())) throw new Error("Past days keep the plan they had");
}

const dayBlockRef = z.object({
  date: isoDate,
  startMin: minute,
  endMin: minute,
  blockTypeId: z.uuid(),
  structureBlockId: z.uuid().nullable(),
  exceptionId: z.uuid().nullable(),
});

const dayBlockChange = z.union([
  z.literal("remove"),
  z.object({ startMin: minute, endMin: minute, blockTypeId: z.uuid() }).partial(),
]);

/** Moves, resizes, reassigns or removes one Block on one date. */
export async function changeDayBlock(block: DayBlockRef, change: DayBlockChange) {
  await requireIvan();
  const ref = dayBlockRef.parse(block);
  editableDay(ref.date);
  const plan = planDayBlockChange(ref, dayBlockChange.parse(change));
  const sameDay = (id: string) =>
    and(eq(s.structureExceptions.id, id), eq(s.structureExceptions.date, ref.date));
  if (plan.kind === "upsert") {
    if (!plan.values.removed) timeRange(plan.values);
    await db
      .insert(s.structureExceptions)
      .values(plan.values)
      .onConflictDoUpdate({
        target: [s.structureExceptions.date, s.structureExceptions.structureBlockId],
        set: plan.values,
      });
  } else if (plan.kind === "update") {
    await db.update(s.structureExceptions).set(timeRange(plan.values)).where(sameDay(plan.id));
  } else {
    await db.delete(s.structureExceptions).where(sameDay(plan.id));
  }
  await done();
}

/** Adds a Block on one date only. */
export async function addDayBlock(input: { date: string; startMin: number; endMin: number; blockTypeId: string }) {
  await requireIvan();
  const values = z
    .object({ date: isoDate, startMin: minute, endMin: minute, blockTypeId: z.uuid() })
    .parse(input);
  editableDay(values.date);
  timeRange(values);
  await db.insert(s.structureExceptions).values({ ...values, structureBlockId: null, removed: false });
  await done();
}

/** Returns one Block (its Exception), or the whole date, to the Structure. */
export async function backToStructure(input: { date: string; exceptionId?: string }) {
  await requireIvan();
  const { date, exceptionId } = z.object({ date: isoDate, exceptionId: z.uuid().optional() }).parse(input);
  editableDay(date);
  await db
    .delete(s.structureExceptions)
    .where(
      and(
        eq(s.structureExceptions.date, date),
        exceptionId ? eq(s.structureExceptions.id, exceptionId) : undefined,
      ),
    );
  await done();
}

// ─── Slots (calendar) ────────────────────────────────────────────────────────

export async function scheduleWork(input: {
  kind: "task" | "move" | "secondary";
  id: string;
  date: string;
  startMin: number;
  endMin: number;
}) {
  await requireIvan();
  const v = workRef
    .extend({ date: isoDate, startMin: minute, endMin: minute })
    .parse(input);
  timeRange(v);
  await db.transaction(async (tx) => {
    await tx.insert(s.slots).values({
      date: v.date,
      startMin: v.startMin,
      endMin: v.endMin,
      workKind: v.kind,
      taskId: v.kind === "task" ? v.id : null,
      moveId: v.kind === "move" ? v.id : null,
      secondaryTaskId: v.kind === "secondary" ? v.id : null,
    });
    if (v.kind === "secondary") await followSlot(tx, v.id, v.date);
  });
  await done();
}

export async function updateSlot(input: {
  id: string;
  date: string;
  startMin: number;
  endMin: number;
}) {
  await requireIvan();
  const { id, ...values } = z
    .object({ id: z.uuid(), date: isoDate, startMin: minute, endMin: minute })
    .parse(input);
  timeRange(values);
  await db.transaction(async (tx) => {
    const [slot] = await tx
      .update(s.slots)
      .set(values)
      .where(eq(s.slots.id, id))
      .returning({ secondaryTaskId: s.slots.secondaryTaskId });
    if (slot?.secondaryTaskId) await followSlot(tx, slot.secondaryTaskId, values.date);
  });
  await syncSlots([id]);
  await done();
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A pending Secondary Task moves to the day of its Slot when that postpones it or brings it forward. */
async function followSlot(tx: Tx, secondaryTaskId: string, slotDate: string) {
  const [task] = await tx
    .select({ day: s.secondaryTasks.day, doneAt: s.secondaryTasks.doneAt })
    .from(s.secondaryTasks)
    .where(eq(s.secondaryTasks.id, secondaryTaskId));
  if (!task || task.doneAt !== null) return;
  const day = dayAfterScheduling(task.day, slotDate, today());
  if (day !== task.day) {
    await tx.update(s.secondaryTasks).set({ day }).where(eq(s.secondaryTasks.id, secondaryTaskId));
  }
}

export async function deleteSlot(input: { id: string }) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(input);
  await db.delete(s.slots).where(eq(s.slots.id, id));
  await syncDeletions();
  await done();
}

const reminderLead = z.number().refine(isReminderLead, "Invalid lead").nullable();

/**
 * Turns a Slot's bell on (with its lead) or off. A Slot that already started
 * takes no new bell. Without Google Calendar connected it asks to connect.
 */
export async function setSlotReminder(input: {
  id: string;
  leadMin: number | null;
}): Promise<{ ok: true } | { ok: false; error: "connect" | "started" }> {
  await requireIvan();
  const v = z.object({ id: z.uuid(), leadMin: reminderLead }).parse(input);
  const [slot] = await db.select().from(s.slots).where(eq(s.slots.id, v.id));
  if (!slot) return { ok: true };
  if (v.leadMin !== null) {
    if (slotStarted(slot, localMoment(new Date(), APP_TIMEZONE))) return { ok: false, error: "started" };
    if (!(await isConnected())) return { ok: false, error: "connect" };
  }
  await db.update(s.slots).set({ reminderLeadMin: v.leadMin }).where(eq(s.slots.id, v.id));
  await syncSlots([v.id]);
  await done();
  return { ok: true };
}

/** Tries the Reminders that did not reach Google again. */
export async function retryReminders() {
  await requireIvan();
  await retryFailedReminders();
  await done();
}

// ─── Daily Note: Check-in, Highlights, Habits ────────────────────────────────

async function ensureDailyNote(date: string) {
  await db.insert(s.dailyNotes).values({ date }).onConflictDoNothing();
}

export async function addSecondaryTask(fd: FormData) {
  await requireIvan();
  const { date, title } = z.object({ date: isoDate, title: required }).parse(fields(fd));
  await ensureDailyNote(date);
  await db.insert(s.secondaryTasks).values({ title, day: date });
  await done();
}

/** Deleting the pending occurrence of an Upkeep stops the Upkeep: there is no Skip. */
export async function deleteSecondaryTask(input: { id: string }) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(input);
  const [task] = await db
    .select({ upkeepId: s.secondaryTasks.upkeepId, doneAt: s.secondaryTasks.doneAt })
    .from(s.secondaryTasks)
    .where(eq(s.secondaryTasks.id, id));
  if (task?.upkeepId && task.doneAt === null) return stopUpkeep({ id: task.upkeepId });
  await db.delete(s.secondaryTasks).where(eq(s.secondaryTasks.id, id));
  await syncDeletions();
  await done();
}

/**
 * Drags a pending Secondary Task to another day in the Month: only to today or
 * later. A Slot from today on keeps its hour; otherwise only its day moves.
 */
export async function moveSecondaryTaskInMonth(input: { id: string; slotId: string | null; date: string }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), slotId: z.uuid().nullable(), date: isoDate }).parse(input);
  await db.transaction(async (tx) => {
    const [task] = await tx
      .select({ doneAt: s.secondaryTasks.doneAt })
      .from(s.secondaryTasks)
      .where(eq(s.secondaryTasks.id, v.id));
    if (!task || task.doneAt !== null) return;
    const [slot] = v.slotId
      ? await tx
          .select({ id: s.slots.id, date: s.slots.date })
          .from(s.slots)
          .where(and(eq(s.slots.id, v.slotId), eq(s.slots.secondaryTaskId, v.id)))
      : [];
    const move = monthMove({ slot: slot ?? null }, v.date, today());
    if (!move) return;
    if (move.kind === "slot") {
      await tx.update(s.slots).set({ date: move.date }).where(eq(s.slots.id, move.slotId));
      await followSlot(tx, v.id, move.date);
    } else {
      await tx.update(s.secondaryTasks).set({ day: move.date }).where(eq(s.secondaryTasks.id, v.id));
    }
  });
  if (v.slotId) await syncSlots([v.slotId]);
  await done();
}

// ─── Upkeeps ─────────────────────────────────────────────────────────────────

const intervalDays = z.coerce.number().refine(isValidInterval, "Invalid interval");

/**
 * Keeps one pending occurrence per Upkeep. Done: the next one is born,
 * counted from today. Reopened: the one born from it goes away.
 */
async function settleUpkeep(tx: Tx, taskId: string, nowDone: boolean) {
  const [task] = await tx
    .select({ upkeepId: s.secondaryTasks.upkeepId, title: s.upkeeps.title, intervalDays: s.upkeeps.intervalDays })
    .from(s.secondaryTasks)
    .innerJoin(s.upkeeps, eq(s.upkeeps.id, s.secondaryTasks.upkeepId))
    .where(eq(s.secondaryTasks.id, taskId));
  if (!task?.upkeepId) return;
  const others = and(
    eq(s.secondaryTasks.upkeepId, task.upkeepId),
    isNull(s.secondaryTasks.doneAt),
    sql`${s.secondaryTasks.id} <> ${taskId}`,
  );
  await tx.delete(s.secondaryTasks).where(others);
  if (nowDone) {
    await tx.insert(s.secondaryTasks).values({
      title: task.title,
      day: nextUpkeepDay(today(), task.intervalDays),
      upkeepId: task.upkeepId,
    });
  }
}

export async function createUpkeep(fd: FormData) {
  await requireIvan();
  const v = z.object({ title: required, day: isoDate, intervalDays }).parse(fields(fd));
  await db.transaction(async (tx) => {
    const [upkeep] = await tx
      .insert(s.upkeeps)
      .values({ title: v.title, intervalDays: v.intervalDays })
      .returning({ id: s.upkeeps.id });
    await tx.insert(s.secondaryTasks).values({ title: v.title, day: v.day, upkeepId: upkeep.id });
  });
  await done();
}

/** Renames it (its pending occurrence too) or changes its interval; the pending one keeps its day. */
export async function updateUpkeep(fd: FormData) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), title: required, intervalDays }).parse(fields(fd));
  const pending = await db.transaction(async (tx) => {
    await tx
      .update(s.upkeeps)
      .set({ title: v.title, intervalDays: v.intervalDays })
      .where(eq(s.upkeeps.id, v.id));
    const renamed = await tx
      .update(s.secondaryTasks)
      .set({ title: v.title })
      .where(and(eq(s.secondaryTasks.upkeepId, v.id), isNull(s.secondaryTasks.doneAt)))
      .returning({ id: s.secondaryTasks.id });
    return renamed.map((task) => task.id);
  });
  await syncWork("secondary", pending);
  await done();
}

/**
 * Marks an occurrence done from the modal. The days chosen there become the
 * Upkeep's interval for this and every next one.
 */
export async function completeUpkeepOccurrence(input: { id: string; intervalDays: number }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), intervalDays }).parse(input);
  await db.transaction(async (tx) => {
    const [task] = await tx
      .update(s.secondaryTasks)
      .set({ doneAt: new Date() })
      .where(and(eq(s.secondaryTasks.id, v.id), isNull(s.secondaryTasks.doneAt)))
      .returning({ upkeepId: s.secondaryTasks.upkeepId });
    if (!task?.upkeepId) return;
    await tx.update(s.upkeeps).set({ intervalDays: v.intervalDays }).where(eq(s.upkeeps.id, task.upkeepId));
    await settleUpkeep(tx, v.id, true);
  });
  await syncWork("secondary", [v.id]);
  await done();
}

/** Stops it: its pending occurrence goes away; the done ones stay as plain history. */
export async function stopUpkeep(input: { id: string }) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(input);
  await db.transaction(async (tx) => {
    await tx
      .delete(s.secondaryTasks)
      .where(and(eq(s.secondaryTasks.upkeepId, id), isNull(s.secondaryTasks.doneAt)));
    await tx.delete(s.upkeeps).where(eq(s.upkeeps.id, id));
  });
  await syncDeletions();
  await done();
}

export async function addNoiseItem(fd: FormData) {
  await requireIvan();
  const { date, title } = z.object({ date: isoDate, title: required }).parse(fields(fd));
  await ensureDailyNote(date);
  await db.insert(s.noiseItems).values({ date, title });
  await done();
}

export async function deleteNoiseItem(input: { id: string }) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(input);
  await db.delete(s.noiseItems).where(eq(s.noiseItems.id, id));
  await done();
}

// ─── Learning Log, Journal and Weekly Review ─────────────────────────────────

const learningBody = required.max(MAX_LEARNING_ENTRY);

export async function addLearningEntry(fd: FormData) {
  await requireIvan();
  const { date, body } = z.object({ date: isoDate, body: learningBody }).parse(fields(fd));
  await db.insert(s.learningEntries).values({ date, body });
  await done();
}

export async function updateLearningEntry(fd: FormData) {
  await requireIvan();
  const { id, body } = z.object({ id: z.uuid(), body: learningBody }).parse(fields(fd));
  await db.update(s.learningEntries).set({ body }).where(eq(s.learningEntries.id, id));
  await done();
}

export async function deleteLearningEntry(input: { id: string }) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(input);
  await db.delete(s.learningEntries).where(eq(s.learningEntries.id, id));
  await done();
}

export async function saveJournal(input: { date: string; journal: string }) {
  await requireIvan();
  const { date, journal } = z.object({ date: isoDate, journal: text.max(MAX_DESCRIPTION) }).parse(input);
  await db
    .insert(s.dailyNotes)
    .values({ date, journal })
    .onConflictDoUpdate({ target: s.dailyNotes.date, set: { journal } });
  await done();
}

const reviewFields = z.object({
  week: isoDate,
  score: z.number().refine(isFeltScore, "The felt score goes from 1 to 10"),
  notes: text.max(MAX_DESCRIPTION),
});

/** Closes the open Review and saves the Moves chosen for the week it plans, as they stand. */
export async function finishWeeklyReview(input: { week: string; score: number; notes: string }) {
  await requireIvan();
  const { week, score, notes } = reviewFields.parse(input);
  const open = openReview(today());
  // Refused: the page refreshes to show the Review is no longer open.
  if (open?.week !== week) return done();
  const chosen = (await getMovesChosenFor(open.plans)).filter((move) => move.active);
  await db.transaction(async (tx) => {
    const [review] = await tx
      .insert(s.weeklyReviews)
      .values({ weekOf: week, feltScore: score, notes })
      .onConflictDoNothing()
      .returning({ week: s.weeklyReviews.weekOf });
    if (!review || chosen.length === 0) return;
    await tx.insert(s.reviewMoves).values(
      chosen.map((move, position) => ({ reviewWeek: week, moveId: move.moveId, title: move.title, position })),
    );
  });
  await done();
}

/** A finished Review keeps its Moves; only its score and notes can be corrected. */
export async function updateWeeklyReview(input: { week: string; score: number; notes: string }) {
  await requireIvan();
  const { week, score, notes } = reviewFields.parse(input);
  await db.update(s.weeklyReviews).set({ feltScore: score, notes }).where(eq(s.weeklyReviews.weekOf, week));
  await done();
}

export async function completeCheckIn(fd: FormData) {
  await requireIvan();
  const { date } = z.object({ date: isoDate }).parse(fields(fd));
  await ensureDailyNote(date);
  await db
    .update(s.dailyNotes)
    .set({ checkInDoneAt: new Date() })
    .where(eq(s.dailyNotes.date, date));
  await done();
}

export async function addHighlight(fd: FormData) {
  await requireIvan();
  const v = z
    .object({
      date: isoDate,
      title: text,
      why: text,
      work: z
        .string()
        .optional()
        .transform((w) => (w ? w : null))
        .pipe(
          z
            .string()
            .regex(/^(task|move):[0-9a-f-]{36}$/)
            .nullable(),
        ),
    })
    .parse(fields(fd));
  const existing = await db.select().from(s.highlights).where(eq(s.highlights.date, v.date));
  const problem = validateNewHighlight(existing, v);
  if (problem) throw new Error(`Cannot add Highlight: ${problem}`);
  const [kind, workId] = v.work ? v.work.split(":") : [null, null];
  await ensureDailyNote(v.date);
  await db.insert(s.highlights).values({
    date: v.date,
    title: v.title,
    why: v.why,
    taskId: kind === "task" ? workId : null,
    moveId: kind === "move" ? workId : null,
    position: existing.length,
  });
  await done();
}

/** A Highlight linked to a Task or Move is done when that work is done. */
export async function toggleHighlight(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  const [highlight] = await db.select().from(s.highlights).where(eq(s.highlights.id, id));
  if (!highlight) return;
  if (highlight.taskId) return toggleWorkDone({ kind: "task", id: highlight.taskId });
  if (highlight.moveId) return toggleWorkDone({ kind: "move", id: highlight.moveId });
  await db
    .update(s.highlights)
    .set({ done: !highlight.done })
    .where(eq(s.highlights.id, id));
  await done();
}

export async function deleteHighlight(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.highlights).where(eq(s.highlights.id, id));
  await done();
}

export async function toggleHabit(input: { date: string; blockTypeId: string }) {
  await requireIvan();
  const { date, blockTypeId } = z
    .object({ date: isoDate, blockTypeId: z.uuid() })
    .parse(input);
  const where = and(eq(s.habitChecks.date, date), eq(s.habitChecks.blockTypeId, blockTypeId));
  const deleted = await db.delete(s.habitChecks).where(where).returning();
  if (deleted.length === 0) {
    await db.insert(s.habitChecks).values({ date, blockTypeId });
  }
  await done();
}

// ─── Cycles ──────────────────────────────────────────────────────────────────

const cycleMinutes = z.coerce.number().int().min(1).max(8 * 60);

/** Closes any Cycle still running, keeping it complete if it was already in its break. */
async function closeOpenCycles(now: Date) {
  const open = await db.select().from(s.cycles).where(isNull(s.cycles.endedAt));
  for (const cycle of open) {
    await db
      .update(s.cycles)
      .set({ endedAt: closeAt(cycle, now) })
      .where(eq(s.cycles.id, cycle.id));
  }
}

/**
 * Starts a Cycle now. The rhythm comes from a preset (the default one when
 * none is given). What is worked on comes from the Slot, the Task/Move, or a
 * free label. Only one Cycle runs at a time.
 */
export async function startCycle(input: {
  presetId?: string;
  work?: { kind: "task" | "move"; id: string } | null;
  slotId?: string | null;
  label?: string;
}) {
  await requireIvan();
  const v = z
    .object({
      presetId: z.uuid().optional(),
      work: strategicWorkRef.nullable().optional(),
      slotId: z.uuid().nullable().optional(),
      label: text.optional(),
    })
    .parse(input);

  const presets = await db
    .select()
    .from(s.cyclePresets)
    .orderBy(asc(s.cyclePresets.position), asc(s.cyclePresets.createdAt));
  const preset = presets.find((p) => p.id === v.presetId) ?? presets[0];
  if (!preset) throw new Error("Create a Cycle preset first");

  let work = v.work ?? null;
  if (v.slotId) {
    const [slot] = await db.select().from(s.slots).where(eq(s.slots.id, v.slotId));
    if (slot?.workKind === "secondary") throw new Error("Secondary Tasks do not have Cycles");
    if (slot) work = { kind: slot.workKind, id: (slot.workKind === "task" ? slot.taskId : slot.moveId)! };
  }

  const now = new Date();
  await closeOpenCycles(now);
  await db.insert(s.cycles).values({
    startedAt: now,
    focusMin: preset.focusMin,
    breakMin: preset.breakMin,
    workKind: work?.kind ?? null,
    taskId: work?.kind === "task" ? work.id : null,
    moveId: work?.kind === "move" ? work.id : null,
    slotId: v.slotId ?? null,
    label: work ? "" : (v.label ?? ""),
  });
  await done();
}

export async function startCycleForm(fd: FormData) {
  const { presetId, work, label } = z
    .object({
      presetId: z.uuid(),
      work: z.string().optional(),
      label: text.optional(),
    })
    .parse(fields(fd));
  const ref = work && /^(task|move):[0-9a-f-]{36}$/.test(work) ? work.split(":") : null;
  await startCycle({
    presetId,
    work: ref ? { kind: ref[0] as "task" | "move", id: ref[1] } : null,
    label,
  });
  redirect("/os/focus");
}

/** Closes the Cycle now: early in the focus, or at its planned end if already in the break. */
export async function endCycle(input: { id: string }) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(input);
  const [cycle] = await db.select().from(s.cycles).where(eq(s.cycles.id, id));
  if (!cycle) return;
  await db
    .update(s.cycles)
    .set({ endedAt: closeAt(cycle, new Date()) })
    .where(eq(s.cycles.id, id));
  await done();
}

const presetFields = z.object({ name: required, focusMin: cycleMinutes, breakMin: z.coerce.number().int().min(0).max(120) });

export async function createCyclePreset(fd: FormData) {
  await requireIvan();
  const values = presetFields.parse(fields(fd));
  const [{ last }] = await db.select({ last: max(s.cyclePresets.position) }).from(s.cyclePresets);
  await db.insert(s.cyclePresets).values({ ...values, position: (last ?? -1) + 1 });
  await done();
}

export async function updateCyclePreset(fd: FormData) {
  await requireIvan();
  const { id, ...values } = presetFields.extend({ id: z.uuid() }).parse(fields(fd));
  await db.update(s.cyclePresets).set(values).where(eq(s.cyclePresets.id, id));
  await done();
}

export async function deleteCyclePreset(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.cyclePresets).where(eq(s.cyclePresets.id, id));
  await done();
}

/** The default preset is the first one. */
export async function makeDefaultCyclePreset(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  const all = await db
    .select()
    .from(s.cyclePresets)
    .orderBy(asc(s.cyclePresets.position), asc(s.cyclePresets.createdAt));
  const ordered = [...all.filter((p) => p.id === id), ...all.filter((p) => p.id !== id)];
  await db.transaction(async (tx) => {
    for (const [position, p] of ordered.entries()) {
      await tx.update(s.cyclePresets).set({ position }).where(eq(s.cyclePresets.id, p.id));
    }
  });
  await done();
}
