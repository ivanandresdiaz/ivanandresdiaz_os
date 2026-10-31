"use server";

import { and, eq, isNull, max, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { addDays, isIsoDate, parseMinutes } from "@/domain/dates";
import { validateNewHighlight } from "@/domain/highlights";
import { normalizeGames } from "@/domain/infinite-games";
import { DAY_END_MIN, MIN_SLOT_MIN } from "@/domain/slots";
import { planStructureEdit, planStructureRemoval, type StructureBlock } from "@/domain/structure";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";

const isoDate = z.string().refine(isIsoDate, "Invalid date");
const minute = z.coerce.number().int().min(0).max(DAY_END_MIN);
const hhmm = z.string().transform((v) => parseMinutes(v));
const text = z.string().trim();
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
  await db.delete(s.principles).where(eq(s.principles.id, id));
  await done();
}

export async function movePrinciple(fd: FormData) {
  await requireIvan();
  const { id, direction } = z
    .object({ id: z.uuid(), direction: z.enum(["up", "down"]) })
    .parse(fields(fd));
  const all = await db.select().from(s.principles).orderBy(s.principles.position);
  const i = all.findIndex((p) => p.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.transaction(async (tx) => {
    for (const [position, p] of all.entries()) {
      await tx.update(s.principles).set({ position }).where(eq(s.principles.id, p.id));
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

export async function createCampaign(fd: FormData) {
  await requireIvan();
  const values = campaignFields
    .extend({ quarterId: optionalId })
    .parse(fields(fd));
  const [campaign] = await db
    .insert(s.campaigns)
    .values({
      ...values,
      games: games(fd),
      status: values.quarterId ? "active" : "candidate",
    })
    .returning({ id: s.campaigns.id });
  redirect(`/os/campaigns/${campaign.id}`);
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

export async function setCampaignStatus(fd: FormData) {
  await requireIvan();
  const { id, status, quarterId } = z
    .object({
      id: z.uuid(),
      status: z.enum(["candidate", "active", "done", "dropped"]),
      quarterId: optionalId,
    })
    .parse(fields(fd));
  await db
    .update(s.campaigns)
    .set(quarterId ? { status, quarterId } : { status })
    .where(eq(s.campaigns.id, id));
  await done();
}

export async function deleteCampaign(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.campaigns).where(eq(s.campaigns.id, id));
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
  await db.insert(s.moves).values({ campaignId, title, weekOf: weekOf ?? null });
  await done();
}

export async function updateMove(fd: FormData) {
  await requireIvan();
  const { id, title } = z.object({ id: z.uuid(), title: required }).parse(fields(fd));
  await db.update(s.moves).set({ title }).where(eq(s.moves.id, id));
  await done();
}

/** Choose a Move for a week (Weekly Review) or send it back (empty weekOf). */
export async function setMoveWeek(fd: FormData) {
  await requireIvan();
  const { id, weekOf } = z
    .object({ id: z.uuid(), weekOf: isoDate.or(z.literal("").transform(() => null)) })
    .parse(fields(fd));
  await db.update(s.moves).set({ weekOf }).where(eq(s.moves.id, id));
  await done();
}

export async function deleteMove(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.moves).where(eq(s.moves.id, id));
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
  await db.insert(s.tasks).values({ moveId, title, durationMin, games: games(fd) });
  await done();
}

export async function updateTask(fd: FormData) {
  await requireIvan();
  const { id, title, durationMin } = z
    .object({
      id: z.uuid(),
      title: required,
      durationMin: z.coerce.number().int().min(MIN_SLOT_MIN).max(DAY_END_MIN),
    })
    .parse(fields(fd));
  await db.update(s.tasks).set({ title, durationMin }).where(eq(s.tasks.id, id));
  await done();
}

export async function deleteTask(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.tasks).where(eq(s.tasks.id, id));
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

const workRef = z.object({ kind: z.enum(["task", "move"]), id: z.uuid() });

/**
 * Marks a Task or Move done (or undone). Highlights that point to it follow,
 * so the Day Won check stays in sync.
 */
export async function toggleWorkDone(input: { kind: "task" | "move"; id: string }) {
  await requireIvan();
  const { kind, id } = workRef.parse(input);
  const table = kind === "task" ? s.tasks : s.moves;
  const [row] = await db.select({ doneAt: table.doneAt }).from(table).where(eq(table.id, id));
  if (!row) return;
  const nowDone = row.doneAt === null;
  await db.transaction(async (tx) => {
    await tx
      .update(table)
      .set({ doneAt: nowDone ? new Date() : null })
      .where(eq(table.id, id));
    await tx
      .update(s.highlights)
      .set({ done: nowDone })
      .where(kind === "task" ? eq(s.highlights.taskId, id) : eq(s.highlights.moveId, id));
  });
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

export async function addStructureBlock(fd: FormData) {
  await requireIvan();
  const values = timeRange(
    z
      .object({
        weekday: z.coerce.number().int().min(1).max(7),
        startMin: hhmm,
        endMin: hhmm,
        blockTypeId: z.uuid(),
      })
      .parse(fields(fd)),
  );
  await db.insert(s.structureBlocks).values({ ...values, validFrom: today() });
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

/** Overrides, removes or adds a Block on one date, without touching the Structure. */
export async function setException(input: {
  date: string;
  structureBlockId: string | null;
  removed: boolean;
  startMin: number;
  endMin: number;
  blockTypeId: string;
}) {
  await requireIvan();
  const values = z
    .object({
      date: isoDate,
      structureBlockId: z.uuid().nullable(),
      removed: z.boolean(),
      startMin: minute,
      endMin: minute,
      blockTypeId: z.uuid(),
    })
    .parse(input);
  if (!values.removed) timeRange(values);
  if (values.structureBlockId) {
    await db
      .insert(s.structureExceptions)
      .values(values)
      .onConflictDoUpdate({
        target: [s.structureExceptions.date, s.structureExceptions.structureBlockId],
        set: values,
      });
  } else {
    await db.insert(s.structureExceptions).values(values);
  }
  await done();
}

export async function updateExceptionTimes(input: {
  id: string;
  startMin: number;
  endMin: number;
}) {
  await requireIvan();
  const { id, ...times } = z
    .object({ id: z.uuid(), startMin: minute, endMin: minute })
    .parse(input);
  timeRange(times);
  await db.update(s.structureExceptions).set(times).where(eq(s.structureExceptions.id, id));
  await done();
}

export async function setExceptionForm(fd: FormData) {
  const v = z
    .object({
      date: isoDate,
      structureBlockId: optionalId,
      removed: z.enum(["true", "false"]).transform((x) => x === "true"),
      startMin: hhmm,
      endMin: hhmm,
      blockTypeId: z.uuid(),
    })
    .parse(fields(fd));
  await setException(v);
}

/** Back to the Structure for that date. */
export async function deleteException(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.structureExceptions).where(eq(s.structureExceptions.id, id));
  await done();
}

// ─── Slots (calendar) ────────────────────────────────────────────────────────

export async function scheduleWork(input: {
  kind: "task" | "move";
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
  await db.insert(s.slots).values({
    date: v.date,
    startMin: v.startMin,
    endMin: v.endMin,
    workKind: v.kind,
    taskId: v.kind === "task" ? v.id : null,
    moveId: v.kind === "move" ? v.id : null,
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
  await db.update(s.slots).set(values).where(eq(s.slots.id, id));
  await done();
}

export async function deleteSlot(input: { id: string }) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(input);
  await db.delete(s.slots).where(eq(s.slots.id, id));
  await done();
}

// ─── Daily Note: Check-in, Highlights, Habits ────────────────────────────────

async function ensureDailyNote(date: string) {
  await db.insert(s.dailyNotes).values({ date }).onConflictDoNothing();
}

export async function saveEliminate(fd: FormData) {
  await requireIvan();
  const { date, eliminate } = z.object({ date: isoDate, eliminate: text }).parse(fields(fd));
  await ensureDailyNote(date);
  await db.update(s.dailyNotes).set({ eliminate }).where(eq(s.dailyNotes.date, date));
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
