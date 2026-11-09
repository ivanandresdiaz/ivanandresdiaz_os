"use server";

import { and, eq, max } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { MAX_LIBRARY_NAME, MAX_SAMPLE_TITLE, sampleKey, samplePrefix, validateSampleFile } from "@/domain/library";
import { deleteObject, objectSize, presignUpload } from "@/lib/r2";
import { requireIvan } from "@/lib/session";
import { deleteIncomingFiles, landClip, lastCreatorPosition, nextSamplePosition, type Tx } from "./clip-landing";

const name = z.string().trim().min(1).max(MAX_LIBRARY_NAME);
const sampleTitle = z
  .string()
  .trim()
  .max(MAX_SAMPLE_TITLE)
  .transform((v) => v || null);

async function done() {
  refresh();
}

async function deleteFiles(keys: string[]) {
  await Promise.all(keys.map((key) => deleteObject(key)));
}

/** Saves a dragged order: `ids` must list exactly the rows `scope` holds. */
async function saveOrder(
  ids: string[],
  existing: { id: string }[],
  update: (tx: Tx, id: string, position: number) => Promise<unknown>,
) {
  const known = new Set(existing.map((row) => row.id));
  if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) return;
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) await update(tx, id, position);
  });
}

// ─── Topics ──────────────────────────────────────────────────────────────────

export async function createTopic(input: { title: string }) {
  await requireIvan();
  const { title } = z.object({ title: name }).parse(input);
  const [{ last }] = await db.select({ last: max(s.topics.position) }).from(s.topics);
  await db.insert(s.topics).values({ title, position: (last ?? -1) + 1 });
  await done();
}

export async function renameTopic(input: { id: string; title: string }) {
  await requireIvan();
  const { id, title } = z.object({ id: z.uuid(), title: name }).parse(input);
  await db.update(s.topics).set({ title }).where(eq(s.topics.id, id));
  await done();
}

export async function reorderTopics(input: { ids: string[] }) {
  await requireIvan();
  const { ids } = z.object({ ids: z.array(z.uuid()) }).parse(input);
  const existing = await db.select({ id: s.topics.id }).from(s.topics);
  await saveOrder(ids, existing, (tx, id, position) =>
    tx.update(s.topics).set({ position }).where(eq(s.topics.id, id)),
  );
  await done();
}

/** Its Creators and their Samples go with it, files included. */
export async function deleteTopic(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  const files = await db
    .select({ key: s.samples.key })
    .from(s.samples)
    .innerJoin(s.creators, eq(s.creators.id, s.samples.creatorId))
    .where(eq(s.creators.topicId, id));
  const creators = await db.select({ id: s.creators.id }).from(s.creators).where(eq(s.creators.topicId, id));
  await deleteIncomingFiles({ creatorIds: creators.map((c) => c.id) });
  await db.delete(s.topics).where(eq(s.topics.id, id));
  await deleteFiles(files.map((f) => f.key));
  await done();
}

// ─── Creators ────────────────────────────────────────────────────────────────

async function requireTopic(conn: Tx | typeof db, topicId: string) {
  const [topic] = await conn.select({ id: s.topics.id }).from(s.topics).where(eq(s.topics.id, topicId));
  if (!topic) throw new Error("Topic not found");
}

export async function createCreator(input: { topicId: string; name: string }) {
  await requireIvan();
  const v = z.object({ topicId: z.uuid(), name }).parse(input);
  await requireTopic(db, v.topicId);
  await db
    .insert(s.creators)
    .values({ topicId: v.topicId, name: v.name, position: await lastCreatorPosition(db, v.topicId) });
  await done();
}

export async function renameCreator(input: { id: string; name: string }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), name }).parse(input);
  await db.update(s.creators).set({ name: v.name }).where(eq(s.creators.id, v.id));
  await done();
}

/** A Creator lives in one Topic; moving it puts it last in the new one. Its files stay where they are. */
export async function moveCreator(input: { id: string; topicId: string }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), topicId: z.uuid() }).parse(input);
  await db.transaction(async (tx) => {
    await requireTopic(tx, v.topicId);
    const [creator] = await tx.select().from(s.creators).where(eq(s.creators.id, v.id));
    if (!creator || creator.topicId === v.topicId) return;
    await tx
      .update(s.creators)
      .set({ topicId: v.topicId, position: await lastCreatorPosition(tx, v.topicId) })
      .where(eq(s.creators.id, v.id));
  });
  await done();
}

export async function reorderCreators(input: { topicId: string; ids: string[] }) {
  await requireIvan();
  const v = z.object({ topicId: z.uuid(), ids: z.array(z.uuid()) }).parse(input);
  const existing = await db.select({ id: s.creators.id }).from(s.creators).where(eq(s.creators.topicId, v.topicId));
  await saveOrder(v.ids, existing, (tx, id, position) =>
    tx
      .update(s.creators)
      .set({ position })
      .where(and(eq(s.creators.id, id), eq(s.creators.topicId, v.topicId))),
  );
  await done();
}

export async function deleteCreator(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  const files = await db.select({ key: s.samples.key }).from(s.samples).where(eq(s.samples.creatorId, id));
  await deleteIncomingFiles({ creatorIds: [id] });
  await db.delete(s.creators).where(eq(s.creators.id, id));
  await deleteFiles(files.map((f) => f.key));
  await done();
}

// ─── Samples ─────────────────────────────────────────────────────────────────

async function requireCreator(conn: Tx | typeof db, creatorId: string) {
  const [creator] = await conn.select().from(s.creators).where(eq(s.creators.id, creatorId));
  if (!creator) throw new Error("Creator not found");
  return creator;
}

/** Signs a one-off upload URL; the browser sends the file straight to R2. */
export async function createSampleUpload(input: { creatorId: string; contentType: string; size: number }) {
  await requireIvan();
  const v = z.object({ creatorId: z.uuid(), contentType: z.string(), size: z.number().int() }).parse(input);
  const problem = validateSampleFile(v);
  if (problem) throw new Error(`Cannot add Sample: ${problem}`);
  await requireCreator(db, v.creatorId);
  const key = sampleKey(v.creatorId, crypto.randomUUID(), v.contentType);
  return { key, uploadUrl: await presignUpload(key) };
}

/** Records a Sample once its file is in R2; it shows first in its Creator. */
export async function confirmSampleUpload(input: {
  creatorId: string;
  key: string;
  contentType: string;
  title: string;
}) {
  await requireIvan();
  const v = z
    .object({
      creatorId: z.uuid(),
      key: z.string().regex(/^[\w/.-]+$/),
      contentType: z.string(),
      title: sampleTitle,
    })
    .parse(input);
  if (!v.key.startsWith(samplePrefix(v.creatorId))) throw new Error("Key outside the Creator");
  const size = await objectSize(v.key);
  if (size === null) throw new Error("The upload did not reach storage");
  const problem = validateSampleFile({ contentType: v.contentType, size });
  if (problem) {
    await deleteObject(v.key);
    throw new Error(`Cannot add Sample: ${problem}`);
  }
  await requireCreator(db, v.creatorId);
  await db
    .insert(s.samples)
    .values({
      creatorId: v.creatorId,
      key: v.key,
      contentType: v.contentType,
      title: v.title,
      sizeBytes: size,
      position: await nextSamplePosition(db, v.creatorId),
    })
    .onConflictDoNothing();
  await done();
}

export async function renameSample(input: { id: string; title: string }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), title: sampleTitle }).parse(input);
  await db.update(s.samples).set({ title: v.title }).where(eq(s.samples.id, v.id));
  await done();
}

export async function reorderSamples(input: { creatorId: string; ids: string[] }) {
  await requireIvan();
  const v = z.object({ creatorId: z.uuid(), ids: z.array(z.uuid()) }).parse(input);
  const existing = await db.select({ id: s.samples.id }).from(s.samples).where(eq(s.samples.creatorId, v.creatorId));
  await saveOrder(v.ids, existing, (tx, id, position) =>
    tx
      .update(s.samples)
      .set({ position })
      .where(and(eq(s.samples.id, id), eq(s.samples.creatorId, v.creatorId))),
  );
  await done();
}

export async function deleteSample(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  const [sample] = await db.delete(s.samples).where(eq(s.samples.id, id)).returning({ key: s.samples.key });
  if (sample) await deleteObject(sample.key);
  await done();
}

// ─── From Clips ──────────────────────────────────────────────────────────────

const clipTarget = z.union([
  z.object({ clipId: z.uuid(), creatorId: z.uuid() }),
  z.object({ clipId: z.uuid(), newCreator: z.object({ topicId: z.uuid(), name }) }),
]);

/**
 * The Clip leaves the bank and becomes the newest Sample of a Creator, made
 * here if it is new. A Creator that has no account yet learns the Clip's, so
 * the next Clip from that account finds it by itself.
 */
export async function moveClipToCreator(
  input: { clipId: string; creatorId: string } | { clipId: string; newCreator: { topicId: string; name: string } },
) {
  await requireIvan();
  const v = clipTarget.parse(input);
  const [clip] = await db.select().from(s.clips).where(eq(s.clips.id, v.clipId));
  if (!clip) throw new Error("This Clip already moved.");
  if ("creatorId" in v) await requireCreator(db, v.creatorId);
  else await requireTopic(db, v.newCreator.topicId);
  await landClip(clip, "creatorId" in v ? { creatorId: v.creatorId } : { newCreator: v.newCreator });
  await done();
}
