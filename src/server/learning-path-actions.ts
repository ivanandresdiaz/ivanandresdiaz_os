"use server";

import { and, eq, inArray, isNull, max } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { isIsoDate, startOfWeek } from "@/domain/dates";
import { normalizeGames } from "@/domain/infinite-games";
import {
  activationProblems,
  describeProblem,
  explorationEndsOn,
  MAX_PATH_TITLE,
  MAX_WHY_NOW,
  normalizeNoteLink,
} from "@/domain/learning-paths";
import { requireIvan } from "@/lib/session";
import { today } from "@/lib/today";
import { countActivePaths } from "./learning-paths";

const isoDate = z.string().refine(isIsoDate, "Invalid date");
const title = z.string().trim().min(1).max(MAX_PATH_TITLE);

function fields(fd: FormData) {
  return Object.fromEntries([...fd.keys()].map((key) => [key, fd.get(key)]));
}

async function nextPathPosition(): Promise<number> {
  const [{ last }] = await db.select({ last: max(s.learningPaths.position) }).from(s.learningPaths);
  return (last ?? -1) + 1;
}

// ─── Learning Paths ──────────────────────────────────────────────────────────

/** Capture a Candidate with only its title: the stack asks nothing more. */
export async function createLearningPath(fd: FormData) {
  await requireIvan();
  const input = z.object({ title }).parse(fields(fd));
  await db.insert(s.learningPaths).values({ title: input.title, position: await nextPathPosition() });
  refresh();
}

export type SavePathResult = { ok: true } | { ok: false; error: string };

/**
 * Save what a Path says about itself. With `activate`, it also becomes Active,
 * which needs its why now, an Infinite Game and a free place.
 */
export async function saveLearningPath(input: {
  id: string;
  title: string;
  whyNow: string;
  games: string[];
  blockTypeId: string | null;
  link: string;
  campaignIds: string[];
  activate: boolean;
}): Promise<SavePathResult> {
  await requireIvan();
  const v = z
    .object({
      id: z.uuid(),
      title,
      whyNow: z.string().trim().max(MAX_WHY_NOW),
      games: z.array(z.string()).transform((g) => normalizeGames(g)),
      blockTypeId: z.uuid().nullable(),
      link: z.string().max(2_000),
      campaignIds: z.array(z.uuid()),
      activate: z.boolean(),
    })
    .parse(input);
  const link = normalizeNoteLink(v.link);
  if (link === null) return { ok: false, error: "The link must start with obsidian:// or https://." };

  const [path] = await db.select().from(s.learningPaths).where(eq(s.learningPaths.id, v.id));
  if (!path) return { ok: false, error: "This Learning Path no longer exists." };
  const active = v.activate || path.status === "active";
  if (active) {
    const problems = activationProblems(v, await countActivePaths(v.id)).filter(
      // An Active Path saving its own text never counts against the limit.
      (p) => v.activate || p !== "full",
    );
    if (problems.length > 0) return { ok: false, error: problems.map(describeProblem).join(" ") };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(s.learningPaths)
      .set({
        title: v.title,
        whyNow: v.whyNow,
        games: v.games,
        blockTypeId: v.blockTypeId,
        link,
        ...(v.activate ? { status: "active" as const, closedAt: null } : {}),
      })
      .where(eq(s.learningPaths.id, v.id));
    await tx.delete(s.learningPathCampaigns).where(eq(s.learningPathCampaigns.pathId, v.id));
    const campaignIds = [...new Set(v.campaignIds)];
    if (campaignIds.length > 0) {
      const known = await tx.select({ id: s.campaigns.id }).from(s.campaigns).where(inArray(s.campaigns.id, campaignIds));
      if (known.length > 0) {
        await tx.insert(s.learningPathCampaigns).values(known.map((c) => ({ pathId: v.id, campaignId: c.id })));
      }
    }
  });
  refresh();
  return { ok: true };
}

/**
 * Stop a Path (back to Candidate, freeing its place), finish it, or drop it.
 * Leaving Active, its open Chapters lose their weeks.
 */
export async function setLearningPathStatus(fd: FormData) {
  await requireIvan();
  const { id, status } = z
    .object({ id: z.uuid(), status: z.enum(["candidate", "done", "dropped"]) })
    .parse(fields(fd));
  await db.transaction(async (tx) => {
    await tx
      .update(s.learningPaths)
      .set({
        status,
        closedAt: status === "candidate" ? null : new Date(),
        ...(status === "candidate" ? { position: await nextPathPosition() } : {}),
      })
      .where(eq(s.learningPaths.id, id));
    await tx
      .update(s.chapters)
      .set({ weekOf: null })
      .where(and(eq(s.chapters.pathId, id), isNull(s.chapters.doneAt)));
  });
  refresh();
}

/** Ivan's priority for the Paths in a list; the others keep theirs. */
export async function reorderLearningPaths(input: { ids: string[] }) {
  await requireIvan();
  const { ids } = z.object({ ids: z.array(z.uuid()) }).parse(input);
  if (new Set(ids).size !== ids.length) return;
  const known = await db.select({ id: s.learningPaths.id }).from(s.learningPaths).where(inArray(s.learningPaths.id, ids));
  if (known.length !== ids.length) return;
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(s.learningPaths).set({ position }).where(eq(s.learningPaths.id, id));
    }
  });
  refresh();
}

export async function deleteLearningPath(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.learningPaths).where(eq(s.learningPaths.id, id));
  refresh();
}

// ─── Chapters ────────────────────────────────────────────────────────────────

export async function createChapter(fd: FormData) {
  await requireIvan();
  const v = z.object({ pathId: z.uuid(), title }).parse(fields(fd));
  const [{ last }] = await db
    .select({ last: max(s.chapters.position) })
    .from(s.chapters)
    .where(eq(s.chapters.pathId, v.pathId));
  await db.insert(s.chapters).values({ pathId: v.pathId, title: v.title, position: (last ?? -1) + 1 });
  refresh();
}

export async function updateChapter(input: { id: string; title: string; link: string }): Promise<SavePathResult> {
  await requireIvan();
  const v = z.object({ id: z.uuid(), title, link: z.string().max(2_000) }).parse(input);
  const link = normalizeNoteLink(v.link);
  if (link === null) return { ok: false, error: "The link must start with obsidian:// or https://." };
  await db.update(s.chapters).set({ title: v.title, link }).where(eq(s.chapters.id, v.id));
  refresh();
  return { ok: true };
}

/** Done when its lessons have their learning record in Obsidian; Ivan ticks it himself. */
export async function toggleChapter(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  const [chapter] = await db.select({ doneAt: s.chapters.doneAt }).from(s.chapters).where(eq(s.chapters.id, id));
  if (!chapter) return;
  await db
    .update(s.chapters)
    .set({ doneAt: chapter.doneAt ? null : new Date() })
    .where(eq(s.chapters.id, id));
  refresh();
}

export async function reorderChapters(input: { pathId: string; ids: string[] }) {
  await requireIvan();
  const { pathId, ids } = z.object({ pathId: z.uuid(), ids: z.array(z.uuid()) }).parse(input);
  const existing = await db.select({ id: s.chapters.id }).from(s.chapters).where(eq(s.chapters.pathId, pathId));
  const known = new Set(existing.map((c) => c.id));
  if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) return;
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx.update(s.chapters).set({ position }).where(eq(s.chapters.id, id));
    }
  });
  refresh();
}

/** Choose a Chapter for a week (Weekly Review) or send it back (empty weekOf). Only an Active Path's. */
export async function setChapterWeek(fd: FormData) {
  await requireIvan();
  const { id, weekOf } = z
    .object({ id: z.uuid(), weekOf: isoDate.or(z.literal("").transform(() => null)) })
    .parse(fields(fd));
  if (weekOf !== null) {
    const [row] = await db
      .select({ status: s.learningPaths.status })
      .from(s.chapters)
      .innerJoin(s.learningPaths, eq(s.learningPaths.id, s.chapters.pathId))
      .where(eq(s.chapters.id, id));
    if (row?.status !== "active") return;
  }
  await db
    .update(s.chapters)
    .set({ weekOf: weekOf && startOfWeek(weekOf) })
    .where(eq(s.chapters.id, id));
  refresh();
}

export async function deleteChapter(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.chapters).where(eq(s.chapters.id, id));
  refresh();
}

// ─── Explorations ────────────────────────────────────────────────────────────

/** Start an Exploration; only one is open at a time. */
export async function startExploration(fd: FormData) {
  await requireIvan();
  const v = z
    .object({ title, endsOn: isoDate.optional().or(z.literal("").transform(() => undefined)) })
    .parse(fields(fd));
  const startedOn = today();
  const endsOn = v.endsOn && v.endsOn > startedOn ? v.endsOn : explorationEndsOn(startedOn);
  await db.transaction(async (tx) => {
    const open = await tx.select({ id: s.explorations.id }).from(s.explorations).where(isNull(s.explorations.verdict));
    if (open.length > 0) return;
    await tx.insert(s.explorations).values({ title: v.title, startedOn, endsOn });
  });
  refresh();
}

/** The verdict: worth a Path (it becomes a Candidate, last in the stack) or drop it. */
export async function endExploration(fd: FormData) {
  await requireIvan();
  const { id, verdict } = z.object({ id: z.uuid(), verdict: z.enum(["path", "drop"]) }).parse(fields(fd));
  const position = await nextPathPosition();
  await db.transaction(async (tx) => {
    const [ended] = await tx
      .update(s.explorations)
      .set({ verdict, endedOn: today() })
      .where(and(eq(s.explorations.id, id), isNull(s.explorations.verdict)))
      .returning({ title: s.explorations.title });
    if (ended && verdict === "path") await tx.insert(s.learningPaths).values({ title: ended.title, position });
  });
  refresh();
}

export async function deleteExploration(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(fields(fd));
  await db.delete(s.explorations).where(eq(s.explorations.id, id));
  refresh();
}
