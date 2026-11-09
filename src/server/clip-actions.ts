"use server";

import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
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
import { startClipRun } from "@/lib/clip-runner";
import { presignUpload, putText } from "@/lib/r2";
import { requireIvan } from "@/lib/session";
import { deleteClipFiles, landClip } from "./clip-landing";
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

/** Where a link already lives, in words, or null when it lives nowhere yet (a Clip in the bank lives nowhere). */
async function whereItLives(url: string): Promise<string | null> {
  const [reference] = await db
    .select({ principle: s.principles.title })
    .from(s.principleReferences)
    .innerJoin(s.principles, eq(s.principles.id, s.principleReferences.principleId))
    .where(eq(s.principleReferences.sourceUrl, url))
    .limit(1);
  if (reference) return `Already a Reference on “${reference.principle}”.`;

  const [sample] = await db
    .select({ creator: s.creators.name })
    .from(s.samples)
    .innerJoin(s.creators, eq(s.creators.id, s.samples.creatorId))
    .where(eq(s.samples.sourceUrl, url))
    .limit(1);
  if (sample) return `Already a Sample of “${sample.creator}” in the Library.`;

  const [incoming] = await db
    .select({ creator: s.creators.name, principle: s.principles.title })
    .from(s.clips)
    .leftJoin(s.creators, eq(s.creators.id, s.clips.creatorId))
    .leftJoin(s.principles, eq(s.principles.id, s.clips.principleId))
    .where(and(eq(s.clips.url, url), or(isNotNull(s.clips.creatorId), isNotNull(s.clips.principleId))))
    .limit(1);
  if (incoming) return `Already on its way to “${incoming.creator ?? incoming.principle}”.`;
  return null;
}

/** Paste and forget: a reel starts downloading at once, a YouTube video is saved as a link. */
export async function addClip(input: { link: string }): Promise<AddClipResult> {
  await requireIvan();
  const { link } = z.object({ link: z.string().max(2000) }).parse(input);
  const parsed = parseClipLink(link);
  if ("problem" in parsed) return { ok: false, message: LINK_PROBLEM_TEXT[parsed.problem] };
  const lives = await whereItLives(parsed.url);
  if (lives) return { ok: false, message: lives };

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

/** Downloads a Clip where its source allows: a reel on Cloud Run now, a YouTube video on Ivan's computer. */
async function queueDownload(clip: { id: string; url: string; source: string }) {
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
  await queueDownload(clip);
  await done();
}

const pasteTarget = z.union([
  z.object({ link: z.string().max(2000), creatorId: z.uuid() }),
  z.object({ link: z.string().max(2000), principleId: z.uuid() }),
]);

/**
 * A link pasted where its content will live: a Creator or a Principle. It
 * downloads by itself (a YouTube video too, on the computer) and lands there
 * as a Sample or a Reference; it never shows in the Clips bank. A link already
 * in the bank leaves it and comes here.
 */
export async function pasteLink(
  input: { link: string; creatorId: string } | { link: string; principleId: string },
): Promise<AddClipResult> {
  await requireIvan();
  const v = pasteTarget.parse(input);
  const parsed = parseClipLink(v.link);
  if ("problem" in parsed) return { ok: false, message: LINK_PROBLEM_TEXT[parsed.problem] };

  const destination: { creatorId: string } | { principleId: string } =
    "creatorId" in v ? { creatorId: v.creatorId } : { principleId: v.principleId };
  const [owner] =
    "creatorId" in destination
      ? await db.select({ id: s.creators.id }).from(s.creators).where(eq(s.creators.id, destination.creatorId))
      : await db.select({ id: s.principles.id }).from(s.principles).where(eq(s.principles.id, destination.principleId));
  if (!owner) return { ok: false, message: "It isn't there anymore." };

  const lives = await whereItLives(parsed.url);
  if (lives) return { ok: false, message: lives };

  const address = { creatorId: null, principleId: null, ...destination };
  const [banked] = await db.select().from(s.clips).where(eq(s.clips.url, parsed.url));
  if (banked) {
    const [clip] = await db
      .update(s.clips)
      .set(address)
      .where(and(eq(s.clips.id, banked.id), isNull(s.clips.creatorId), isNull(s.clips.principleId)))
      .returning();
    if (!clip) return { ok: false, message: "It is already on its way somewhere else." };
    if (clip.status === "ready") {
      try {
        await landClip(clip, destination);
      } catch (error) {
        // It stays on its way; the next look at it lands it.
        console.error("A Clip from the bank did not land", error);
      }
    } else if (clip.status === "failed" || (clip.status === "link" && !tooLong(clip.durationS))) {
      await queueDownload(clip);
    }
  } else {
    const title = parsed.source === "youtube" ? await youtubeTitle(parsed.url) : null;
    const [clip] = await db
      .insert(s.clips)
      .values({ url: parsed.url, source: parsed.source, title, status: "link", ...address })
      .onConflictDoNothing()
      .returning();
    if (!clip) return { ok: false, message: "Someone just saved it. Try again." };
    await queueDownload(clip);
  }
  await done();
  return { ok: true };
}

const tooLong = (durationS: number | null) => durationS !== null && durationS > MAX_CLIP_SECONDS;

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
  await deleteClipFiles(clip);
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
  const [clip] = await db.select().from(s.clips).where(eq(s.clips.id, clipId));
  if (!clip) throw new Error("This Clip already moved.");
  const [principle] = await db
    .select({ id: s.principles.id })
    .from(s.principles)
    .where(eq(s.principles.id, principleId));
  if (!principle) throw new Error("Principle not found");
  await landClip(clip, { principleId });
  await done();
}
