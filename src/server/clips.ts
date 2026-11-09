import "server-only";
import { and, count, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import {
  clipFileKey,
  clipResultKey,
  COMPUTER_CHECK_KEY,
  downloadPlace,
  fallbackClipTitle,
  settleClip,
  TOO_LONG_TO_KEEP,
  youtubeIdOf,
  youtubeThumbnail,
  type ClipResult,
  type ClipSource,
  type ClipStatus,
  type DownloadPlace,
} from "@/domain/clips";
import { deleteObject, getText, objectSize, presignView } from "@/lib/r2";
import { landClip } from "./clip-landing";

export type ClipView = {
  id: string;
  url: string;
  source: ClipSource;
  /** What to show: Ivan's title, the post's, or what it is. */
  title: string;
  status: ClipStatus;
  /** Where it downloads: Cloud Run, or Ivan's computer. */
  place: DownloadPlace;
  /** When the download running now started (ISO), for the time that ticks. */
  startedAt: string | null;
  /** The try now running: 0, or 1 and 2 for the retries. */
  attempt: number;
  error: string | null;
  durationS: number | null;
  thumbnail: string | null;
  /** The downloaded file, signed for viewing. */
  videoUrl: string | null;
  /** Where a link pasted where content lives is going; both null for a Clip in the bank. */
  creatorId: string | null;
  principleId: string | null;
  /** The account that posted it, when the downloader said. */
  author: string | null;
  /** For a pasted link waiting for the computer: when the computer last looked. */
  computerCheckedAt?: string | null;
};

const result: z.ZodType<ClipResult> = z.union([
  z.object({
    ok: z.literal(true),
    title: z.string().nullable(),
    author: z.string().nullable().optional(),
    durationS: z.number().nullable(),
    contentType: z.string(),
    sizeBytes: z.number(),
    attempt: z.number(),
  }),
  z.object({
    ok: z.literal(false),
    final: z.boolean(),
    reason: z.enum(["too_long", "login", "rate_limit", "empty", "unavailable", "error"]),
    message: z.string(),
    attempt: z.number(),
    durationS: z.number().optional(),
    title: z.string().nullable().optional(),
  }),
]);

const trimTitle = (title: string | null) => title?.trim().slice(0, 200) || null;

/**
 * Reads back what each download in flight left in R2 and settles its Clip.
 * Runs whenever Clips are looked at, so a Clip that finished while nobody
 * watched is ready the next time Ivan opens them.
 */
export async function settleDownloads(now = new Date()) {
  const pending = await db.select().from(s.clips).where(eq(s.clips.status, "downloading"));
  await Promise.all(
    pending.map(async (clip) => {
      if (!clip.run || !clip.startedAt) return;
      const resultKey = clipResultKey(clip.id, clip.run);
      const text = await getText(resultKey);
      let parsed: ClipResult | null = null;
      if (text) {
        try {
          parsed = result.parse(JSON.parse(text));
        } catch {
          parsed = { ok: false, final: true, reason: "error", message: "Unreadable result", attempt: 0 };
        }
      }
      const outcome = settleClip(parsed, clip.startedAt, now);
      const same = and(eq(s.clips.id, clip.id), eq(s.clips.run, clip.run), eq(s.clips.status, "downloading"));
      if (outcome.status === "downloading") {
        if (outcome.attempt !== null && outcome.attempt !== clip.attempt) {
          await db.update(s.clips).set({ attempt: outcome.attempt }).where(same);
        }
        return;
      }

      if (outcome.status === "ready") {
        const fileKey = clipFileKey(clip.id, clip.run);
        const size = await objectSize(fileKey);
        if (size === null) {
          await db.update(s.clips).set({ status: "failed", error: "The file never arrived." }).where(same);
        } else {
          await db
            .update(s.clips)
            .set({
              status: "ready",
              key: fileKey,
              contentType: outcome.contentType,
              sizeBytes: size,
              durationS: outcome.durationS,
              title: sql`coalesce(${s.clips.title}, ${trimTitle(outcome.title)})`,
              author: outcome.author?.trim().slice(0, 120) || null,
              error: null,
            })
            .where(same);
        }
      } else {
        // A link pasted where content lives must have its file; a long video can't stay there as a link.
        const pasted = clip.creatorId !== null || clip.principleId !== null;
        await db
          .update(s.clips)
          .set({
            status: outcome.status,
            error: pasted && outcome.status === "link" ? TOO_LONG_TO_KEEP : outcome.error,
            durationS: outcome.durationS,
            title: sql`coalesce(${s.clips.title}, ${trimTitle(outcome.title)})`,
          })
          .where(same);
      }
      await deleteObject(resultKey);
    }),
  );
  await landArrived();
}

const addressed = or(isNotNull(s.clips.creatorId), isNotNull(s.clips.principleId));
const banked = and(isNull(s.clips.creatorId), isNull(s.clips.principleId));

/** Links pasted where content lives whose file is in: each becomes a Sample or a Reference there. */
async function landArrived() {
  const arrived = await db
    .select()
    .from(s.clips)
    .where(and(eq(s.clips.status, "ready"), addressed));
  for (const clip of arrived) {
    const destination = clip.creatorId ? { creatorId: clip.creatorId } : { principleId: clip.principleId as string };
    try {
      await landClip(clip, destination);
    } catch (error) {
      // Another look may have landed it first; if not, the next look tries again.
      console.error("A pasted link did not land", error);
    }
  }
}

/** Links on their way to where they will live, settled, oldest first. */
export async function getIncoming(): Promise<ClipView[]> {
  const rows = await db.select().from(s.clips).where(addressed).orderBy(s.clips.createdAt);
  const checkedAt = rows.some((row) => row.status === "waiting") ? await getComputerCheckedAt() : null;
  return Promise.all(rows.map(async (row) => ({ ...(await clipView(row)), computerCheckedAt: checkedAt })));
}

/** Clips, newest first, settled. */
export async function getClipsView(): Promise<ClipView[]> {
  await settleDownloads();
  const rows = await db.select().from(s.clips).where(banked).orderBy(desc(s.clips.createdAt));
  return Promise.all(rows.map(clipView));
}

/** The Clips that can become a Reference: those with their file. */
export async function getReadyClips(): Promise<ClipView[]> {
  return (await getClipsView()).filter((clip) => clip.status === "ready");
}

async function clipView(row: typeof s.clips.$inferSelect): Promise<ClipView> {
  const source = row.source as ClipSource;
  const youtubeId = source === "youtube" ? youtubeIdOf(row.url) : null;
  return {
    id: row.id,
    url: row.url,
    source,
    title: row.title ?? fallbackClipTitle(source),
    status: row.status as ClipStatus,
    place: downloadPlace(source),
    startedAt: row.startedAt?.toISOString() ?? null,
    attempt: row.attempt,
    error: row.error,
    durationS: row.durationS,
    thumbnail: youtubeId ? youtubeThumbnail(youtubeId) : null,
    videoUrl: row.status === "ready" && row.key ? await presignView(row.key) : null,
    author: row.author,
    creatorId: row.creatorId,
    principleId: row.principleId,
  };
}

/** How many Clips wait in the bank, and how many of them have their file. */
export async function countClips(): Promise<{ total: number; ready: number }> {
  const [row] = await db
    .select({ total: count(), ready: count(sql`case when ${s.clips.status} = 'ready' then 1 end`) })
    .from(s.clips)
    .where(banked);
  return { total: row?.total ?? 0, ready: row?.ready ?? 0 };
}

/** When Ivan's computer last looked for waiting Clips (ISO), or null if it never did. */
export async function getComputerCheckedAt(): Promise<string | null> {
  const text = await getText(COMPUTER_CHECK_KEY);
  if (!text) return null;
  try {
    const { checkedAt } = JSON.parse(text) as { checkedAt?: unknown };
    return typeof checkedAt === "string" && !Number.isNaN(Date.parse(checkedAt)) ? checkedAt : null;
  } catch {
    return null;
  }
}
