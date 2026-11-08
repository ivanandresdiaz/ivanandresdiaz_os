"use server";

import { and, eq, inArray, max } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import {
  downloadPlace,
  downloadsOnSave,
  clipFileKey,
  clipResultKey,
  clipWaitingKey,
  LINK_PROBLEM_TEXT,
  MAX_CLIP_SECONDS,
  MAX_CLIP_TITLE,
  parseClipLink,
  type ClipSource,
} from "@/domain/clips";
import { referenceKey } from "@/domain/references";
import { startClipRun } from "@/lib/clip-runner";
import { copyObject, deleteObject, presignUpload, putText } from "@/lib/r2";
import { requireIvan } from "@/lib/session";
import { getReadyClips, type ClipView } from "./clips";

/** Upload links outlive every Cloud Run attempt (three runs of up to an hour) and its queue. */
const RUN_LINK_TTL_SECONDS = 5 * 60 * 60;

async function done() {
  refresh();
}

export type AddClipResult = { ok: true } | { ok: false; message: string };

/** The title YouTube gives a video, or null if it doesn't answer quickly. */
async function youtubeTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { title?: unknown };
    return typeof body.title === "string" ? body.title.trim().slice(0, MAX_CLIP_TITLE) || null : null;
  } catch {
    return null;
  }
}

/** A new run of the download: new keys, so nothing from an earlier run is read as this one's. */
async function startDownload(clipId: string, url: string) {
  const run = crypto.randomUUID();
  const [fileUploadUrl, resultUploadUrl] = await Promise.all([
    presignUpload(clipFileKey(clipId, run), RUN_LINK_TTL_SECONDS),
    presignUpload(clipResultKey(clipId, run), RUN_LINK_TTL_SECONDS),
  ]);
  await db
    .update(s.clips)
    .set({ status: "downloading", run, attempt: 0, startedAt: new Date(), error: null, key: null })
    .where(eq(s.clips.id, clipId));
  try {
    await startClipRun({ url, fileUploadUrl, resultUploadUrl, maxSeconds: MAX_CLIP_SECONDS });
  } catch (error) {
    console.error("Clip download did not start", error);
    await db
      .update(s.clips)
      .set({ status: "failed", error: "Couldn't start the download." })
      .where(and(eq(s.clips.id, clipId), eq(s.clips.run, run)));
  }
}

/** Paste and forget: a reel starts downloading at once, a YouTube video is saved as a link. */
export async function addClip(input: { link: string }): Promise<AddClipResult> {
  await requireIvan();
  const { link } = z.object({ link: z.string().max(2000) }).parse(input);
  const parsed = parseClipLink(link);
  if ("problem" in parsed) return { ok: false, message: LINK_PROBLEM_TEXT[parsed.problem] };

  const [reference] = await db
    .select({ principle: s.principles.title })
    .from(s.principleReferences)
    .innerJoin(s.principles, eq(s.principles.id, s.principleReferences.principleId))
    .where(eq(s.principleReferences.sourceUrl, parsed.url))
    .limit(1);
  if (reference) return { ok: false, message: `Already a Reference on “${reference.principle}”.` };

  const title = parsed.source === "youtube" ? await youtubeTitle(parsed.url) : null;
  const [clip] = await db
    .insert(s.clips)
    .values({ url: parsed.url, source: parsed.source, title, status: "link" })
    .onConflictDoNothing()
    .returning({ id: s.clips.id });
  if (!clip) return { ok: false, message: "Already in Clips." };

  if (downloadsOnSave(parsed.source)) await startDownload(clip.id, parsed.url);
  await done();
  return { ok: true };
}

/**
 * Retry after a failure, or download a Clip saved as a link. A reel goes to
 * Cloud Run now; a YouTube video waits for Ivan's computer to pick it up.
 */
export async function downloadClip(input: { id: string }) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse(input);
  const [clip] = await db
    .select()
    .from(s.clips)
    .where(and(eq(s.clips.id, id), inArray(s.clips.status, ["failed", "link"])));
  if (!clip) return;
  if (downloadPlace(clip.source as ClipSource) === "computer") {
    await db
      .update(s.clips)
      .set({ status: "waiting", error: null, run: null, attempt: 0, startedAt: null, key: null })
      .where(eq(s.clips.id, clip.id));
    // The computer looks only for this marker, so Neon can sleep while nothing waits.
    await putText(clipWaitingKey(clip.id), "");
  } else {
    await startDownload(clip.id, clip.url);
  }
  await done();
}

export async function renameClip(input: { id: string; title: string }) {
  await requireIvan();
  const { id, title } = z.object({ id: z.uuid(), title: z.string().trim().min(1).max(MAX_CLIP_TITLE) }).parse(input);
  await db.update(s.clips).set({ title }).where(eq(s.clips.id, id));
  await done();
}

export async function deleteClip(fd: FormData) {
  await requireIvan();
  const { id } = z.object({ id: z.uuid() }).parse({ id: fd.get("id") });
  const [clip] = await db.delete(s.clips).where(eq(s.clips.id, id)).returning();
  if (!clip) return;
  await Promise.all([
    clip.key && deleteObject(clip.key),
    clip.run && deleteObject(clipFileKey(clip.id, clip.run)),
    clip.run && deleteObject(clipResultKey(clip.id, clip.run)),
    clip.status === "waiting" && deleteObject(clipWaitingKey(clip.id)),
  ]);
  await done();
}

/** The Clips a Principle can take as References. */
export async function listReadyClips(): Promise<ClipView[]> {
  await requireIvan();
  return getReadyClips();
}

/**
 * The Clip leaves the bank and becomes a Reference on the Principle: its file
 * moves under the Principle, and only the link to the post stays with it.
 */
export async function moveClipToPrinciple(input: { clipId: string; principleId: string }) {
  await requireIvan();
  const { clipId, principleId } = z.object({ clipId: z.uuid(), principleId: z.uuid() }).parse(input);
  const [clip] = await db
    .select()
    .from(s.clips)
    .where(and(eq(s.clips.id, clipId), eq(s.clips.status, "ready")));
  if (!clip?.key || !clip.contentType || clip.sizeBytes === null) throw new Error("This Clip has no file to move.");
  const [principle] = await db
    .select({ id: s.principles.id })
    .from(s.principles)
    .where(eq(s.principles.id, principleId));
  if (!principle) throw new Error("Principle not found");

  const key = referenceKey(principleId, crypto.randomUUID(), clip.contentType);
  await copyObject(clip.key, key);
  try {
    await db.transaction(async (tx) => {
      const gone = await tx
        .delete(s.clips)
        .where(and(eq(s.clips.id, clipId), eq(s.clips.status, "ready")))
        .returning({ id: s.clips.id });
      if (gone.length === 0) throw new Error("This Clip already moved.");
      const [{ last }] = await tx
        .select({ last: max(s.principleReferences.position) })
        .from(s.principleReferences)
        .where(eq(s.principleReferences.principleId, principleId));
      await tx.insert(s.principleReferences).values({
        principleId,
        key,
        contentType: clip.contentType as string,
        title: null,
        sourceUrl: clip.url,
        sizeBytes: clip.sizeBytes as number,
        position: (last ?? -1) + 1,
      });
    });
  } catch (error) {
    await deleteObject(key);
    throw error;
  }
  await deleteObject(clip.key);
  await done();
}
