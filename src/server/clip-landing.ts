import "server-only";
import { and, eq, inArray, max, min } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { clipFileKey, clipResultKey, clipWaitingKey } from "@/domain/clips";
import { firstPosition, MAX_SAMPLE_TITLE, normalizeAccount, sampleKey } from "@/domain/library";
import { referenceKey } from "@/domain/references";
import { copyObject, deleteObject } from "@/lib/r2";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Conn = Tx | typeof db;
export type ClipRow = typeof s.clips.$inferSelect;

/** Where a Clip's file goes: a Creator (new or not) as a Sample, or a Principle as a Reference. */
export type Destination =
  { creatorId: string } | { newCreator: { topicId: string; name: string } } | { principleId: string };

/** Whether a Creator already posts from this account (stored normalized). */
export async function accountTaken(conn: Conn, account: string) {
  const [row] = await conn
    .select({ id: s.creators.id })
    .from(s.creators)
    .where(eq(s.creators.account, account))
    .limit(1);
  return Boolean(row);
}

export async function lastCreatorPosition(conn: Conn, topicId: string) {
  const [{ last }] = await conn
    .select({ last: max(s.creators.position) })
    .from(s.creators)
    .where(eq(s.creators.topicId, topicId));
  return (last ?? -1) + 1;
}

/** A new Sample goes first in its Creator. */
export async function nextSamplePosition(conn: Conn, creatorId: string) {
  const [{ lowest }] = await conn
    .select({ lowest: min(s.samples.position) })
    .from(s.samples)
    .where(eq(s.samples.creatorId, creatorId));
  return firstPosition(lowest);
}

/** A Reference goes last in its Principle, as an upload does. */
async function nextReferencePosition(conn: Conn, principleId: string) {
  const [{ last }] = await conn
    .select({ last: max(s.principleReferences.position) })
    .from(s.principleReferences)
    .where(eq(s.principleReferences.principleId, principleId));
  return (last ?? -1) + 1;
}

/**
 * The Clip leaves the bank (or the place it was pasted) and becomes a Sample
 * or a Reference: its file is copied under its new home, and only the link to
 * the post stays with it. A Creator with no account yet learns the Clip's,
 * unless another Creator already posts from it. Throws if it already moved.
 */
export async function landClip(clip: ClipRow, destination: Destination) {
  if (clip.status !== "ready" || !clip.key || !clip.contentType || clip.sizeBytes === null) {
    throw new Error("This Clip has no file to move.");
  }
  const { contentType, sizeBytes } = clip;
  const toPrinciple = "principleId" in destination;
  // The file's key names its owner, so a new Creator's id is chosen before the copy.
  const ownerId = toPrinciple
    ? destination.principleId
    : "creatorId" in destination
      ? destination.creatorId
      : crypto.randomUUID();
  const key = toPrinciple
    ? referenceKey(ownerId, crypto.randomUUID(), contentType)
    : sampleKey(ownerId, crypto.randomUUID(), contentType);
  const account = normalizeAccount(clip.author);

  await copyObject(clip.key, key);
  try {
    await db.transaction(async (tx) => {
      const gone = await tx
        .delete(s.clips)
        .where(and(eq(s.clips.id, clip.id), eq(s.clips.status, "ready")))
        .returning({ id: s.clips.id });
      if (gone.length === 0) throw new Error("This Clip already moved.");

      if (toPrinciple) {
        await tx.insert(s.principleReferences).values({
          principleId: ownerId,
          key,
          contentType,
          title: null,
          sourceUrl: clip.url,
          sizeBytes,
          position: await nextReferencePosition(tx, ownerId),
        });
        return;
      }

      const free = account && !(await accountTaken(tx, account)) ? account : null;
      if ("newCreator" in destination) {
        await tx.insert(s.creators).values({
          id: ownerId,
          topicId: destination.newCreator.topicId,
          name: destination.newCreator.name,
          account: free,
          position: await lastCreatorPosition(tx, destination.newCreator.topicId),
        });
      } else if (free) {
        const [creator] = await tx
          .select({ account: s.creators.account })
          .from(s.creators)
          .where(eq(s.creators.id, ownerId));
        if (!creator) throw new Error("Creator not found");
        if (!creator.account) await tx.update(s.creators).set({ account: free }).where(eq(s.creators.id, ownerId));
      }
      await tx.insert(s.samples).values({
        creatorId: ownerId,
        key,
        contentType,
        title: clip.title?.slice(0, MAX_SAMPLE_TITLE) ?? null,
        sourceUrl: clip.url,
        sizeBytes,
        position: await nextSamplePosition(tx, ownerId),
      });
    });
  } catch (error) {
    await deleteObject(key);
    throw error;
  }
  await deleteObject(clip.key);
}

/** Everything a Clip may have left in R2: its file, its run's file and result, and the computer's marker. */
export async function deleteClipFiles(clip: ClipRow) {
  await Promise.all([
    clip.key && deleteObject(clip.key),
    clip.run && deleteObject(clipFileKey(clip.id, clip.run)),
    clip.run && deleteObject(clipResultKey(clip.id, clip.run)),
    clip.status === "waiting" && deleteObject(clipWaitingKey(clip.id)),
  ]);
}

/** The files of the links still downloading toward the Creators or the Principle about to be deleted. */
export async function deleteIncomingFiles(where: { creatorIds: string[] } | { principleId: string }) {
  const rows =
    "principleId" in where
      ? await db.select().from(s.clips).where(eq(s.clips.principleId, where.principleId))
      : where.creatorIds.length > 0
        ? await db.select().from(s.clips).where(inArray(s.clips.creatorId, where.creatorIds))
        : [];
  await Promise.all(rows.map(deleteClipFiles));
}
