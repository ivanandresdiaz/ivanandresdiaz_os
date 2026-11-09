import "server-only";
import { and, eq, isNotNull, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import { sampleKey } from "@/domain/library";
import { referenceKey, referenceKindOf } from "@/domain/references";
import {
  normalizeTrim,
  settleTrim,
  TRIM_LINK_TTL_SECONDS,
  TRIM_PROBLEM_TEXT,
  trimmedContentType,
  trimProblem,
  trimResultKey,
  type TrimRange,
  type TrimResult,
  type TrimStatus,
} from "@/domain/trims";
import { startTrimRun } from "@/lib/clip-runner";
import { deleteObject, getText, objectSize, presignDownload, presignUpload } from "@/lib/r2";

type TrimRow = typeof s.trims.$inferSelect;

/** A Sample's or Reference's Trim in flight, or the one that failed. */
export type TrimView = {
  id: string;
  status: TrimStatus;
  startS: number | null;
  endS: number | null;
  error: string | null;
};

/** What is being trimmed: one Sample or one Reference. */
export type TrimTarget = { sampleId: string } | { referenceId: string };

export type TrimAnswer = { ok: true } | { ok: false; message: string };

const result: z.ZodType<TrimResult> = z.union([
  z.object({
    ok: z.literal(true),
    contentType: z.string(),
    sizeBytes: z.number(),
    durationS: z.number().nullable(),
    attempt: z.number(),
  }),
  z.object({
    ok: z.literal(false),
    final: z.boolean(),
    reason: z.enum(["nothing_left", "unreadable", "error"]),
    message: z.string(),
    attempt: z.number(),
  }),
]);

const kindOf = (contentType: string) => {
  const kind = referenceKindOf(contentType);
  return kind === "video" || kind === "audio" ? kind : null;
};

/** The file the Trim cuts, and where its cut file goes (named after its owner, like any upload). */
async function itemOf(target: TrimTarget) {
  if ("sampleId" in target) {
    const [sample] = await db.select().from(s.samples).where(eq(s.samples.id, target.sampleId));
    return (
      sample && {
        key: sample.key,
        contentType: sample.contentType,
        newKey: (ct: string) => sampleKey(sample.creatorId, crypto.randomUUID(), ct),
      }
    );
  }
  const [reference] = await db
    .select()
    .from(s.principleReferences)
    .where(eq(s.principleReferences.id, target.referenceId));
  return (
    reference && {
      key: reference.key,
      contentType: reference.contentType,
      newKey: (ct: string) => referenceKey(reference.principleId, crypto.randomUUID(), ct),
    }
  );
}

const sameItem = (target: TrimTarget) =>
  "sampleId" in target ? eq(s.trims.sampleId, target.sampleId) : eq(s.trims.referenceId, target.referenceId);

/**
 * Starts cutting a Sample's or Reference's file down to `range`. It keeps
 * playing whole until the cut file is in; a failed Trim before it is dropped.
 */
export async function beginTrim(target: TrimTarget, asked: TrimRange): Promise<TrimAnswer> {
  const item = await itemOf(target);
  if (!item) return { ok: false, message: "It isn't there anymore." };
  const kind = kindOf(item.contentType);
  if (!kind) return { ok: false, message: "Only a video or an audio can be trimmed." };
  const range = normalizeTrim(asked, null);
  const problem = trimProblem(range, null);
  if (problem) return { ok: false, message: TRIM_PROBLEM_TEXT[problem] };

  const [earlier] = await db.select().from(s.trims).where(sameItem(target));
  if (earlier?.status === "trimming") return { ok: false, message: "It's already being trimmed." };
  if (earlier) await dropTrim(earlier);

  const contentType = trimmedContentType(kind);
  const [trim] = await db
    .insert(s.trims)
    .values({
      ...target,
      fromKey: item.key,
      key: item.newKey(contentType),
      contentType,
      startS: range.startS,
      endS: range.endS,
      status: "trimming",
      run: crypto.randomUUID(),
      startedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (!trim) return { ok: false, message: "It's already being trimmed." };
  await launch(trim);
  return { ok: true };
}

/** A failed Trim runs again, as a new run with the same cut. */
export async function retryTrim(id: string) {
  const [trim] = await db
    .update(s.trims)
    .set({ status: "trimming", run: crypto.randomUUID(), attempt: 0, startedAt: new Date(), error: null })
    .where(
      and(
        eq(s.trims.id, id),
        eq(s.trims.status, "failed"),
        or(isNotNull(s.trims.sampleId), isNotNull(s.trims.referenceId)),
      ),
    )
    .returning();
  if (trim) await launch(trim);
}

/** Ivan gives up on a failed Trim; the file stays whole. */
export async function dismissTrim(id: string) {
  const [trim] = await db
    .select()
    .from(s.trims)
    .where(and(eq(s.trims.id, id), eq(s.trims.status, "failed")));
  if (trim) await dropTrim(trim);
}

async function launch(trim: TrimRow) {
  try {
    const [sourceUrl, fileUploadUrl, resultUploadUrl] = await Promise.all([
      presignDownload(trim.fromKey, TRIM_LINK_TTL_SECONDS),
      presignUpload(trim.key, TRIM_LINK_TTL_SECONDS),
      presignUpload(trimResultKey(trim.id, trim.run), TRIM_LINK_TTL_SECONDS),
    ]);
    await startTrimRun({
      sourceUrl,
      fileUploadUrl,
      resultUploadUrl,
      kind: trim.contentType.startsWith("video/") ? "video" : "audio",
      startS: trim.startS,
      endS: trim.endS,
    });
  } catch (error) {
    console.error("Trim did not start", error);
    await db
      .update(s.trims)
      .set({ status: "failed", error: "Couldn't start the trim." })
      .where(and(eq(s.trims.id, trim.id), eq(s.trims.run, trim.run)));
  }
}

/** The Trim goes, with whatever it left in R2. */
async function dropTrim(trim: TrimRow) {
  await db.delete(s.trims).where(eq(s.trims.id, trim.id));
  await Promise.all([deleteObject(trim.key), deleteObject(trimResultKey(trim.id, trim.run))]);
}

/**
 * Reads back what each Trim in flight left in R2. A finished one hands its
 * file to its Sample or Reference and the old file is thrown away. Runs
 * whenever the Library or the Principles are looked at.
 */
export async function settleTrims(now = new Date()) {
  const rows = await db.select().from(s.trims).where(eq(s.trims.status, "trimming"));
  await Promise.all(rows.map((trim) => settleOne(trim, now)));
  // A Sample or Reference deleted while its Trim failed: nothing will come for it.
  const orphans = await db
    .select()
    .from(s.trims)
    .where(and(eq(s.trims.status, "failed"), isNull(s.trims.sampleId), isNull(s.trims.referenceId)));
  await Promise.all(orphans.map(dropTrim));
}

async function settleOne(trim: TrimRow, now: Date) {
  const resultKey = trimResultKey(trim.id, trim.run);
  const text = await getText(resultKey);
  let parsed: TrimResult | null = null;
  if (text) {
    try {
      parsed = result.parse(JSON.parse(text));
    } catch {
      parsed = { ok: false, final: true, reason: "error", message: "Unreadable result", attempt: 0 };
    }
  }
  const outcome = settleTrim(parsed, trim.startedAt, now);
  const same = and(eq(s.trims.id, trim.id), eq(s.trims.run, trim.run), eq(s.trims.status, "trimming"));
  if (outcome.status === "trimming") {
    if (outcome.attempt !== null && outcome.attempt !== trim.attempt) {
      await db.update(s.trims).set({ attempt: outcome.attempt }).where(same);
    }
    return;
  }
  const size = outcome.status === "done" ? await objectSize(trim.key) : null;
  if (outcome.status === "failed" || size === null) {
    const error = outcome.status === "failed" ? outcome.error : "The trimmed file never arrived.";
    await db.update(s.trims).set({ status: "failed", error }).where(same);
    await deleteObject(resultKey);
    return;
  }

  // Only the look that removes the Trim swaps the file, and only if the file is still the one it cut.
  const swapped = await db.transaction(async (tx) => {
    const gone = await tx.delete(s.trims).where(same).returning({ id: s.trims.id });
    if (gone.length === 0) return null;
    const file = { key: trim.key, contentType: outcome.contentType, sizeBytes: size };
    const updated = trim.sampleId
      ? await tx
          .update(s.samples)
          .set(file)
          .where(and(eq(s.samples.id, trim.sampleId), eq(s.samples.key, trim.fromKey)))
          .returning({ id: s.samples.id })
      : trim.referenceId
        ? await tx
            .update(s.principleReferences)
            .set(file)
            .where(and(eq(s.principleReferences.id, trim.referenceId), eq(s.principleReferences.key, trim.fromKey)))
            .returning({ id: s.principleReferences.id })
        : [];
    return updated.length > 0;
  });
  if (swapped === null) return;
  // Swapped: the old file goes. Not swapped (deleted meanwhile): the cut file goes.
  await Promise.all([deleteObject(swapped ? trim.fromKey : trim.key), deleteObject(resultKey)]);
}

/** The Trims of every Sample and Reference, by its id. */
export async function getTrimViews(): Promise<Map<string, TrimView>> {
  const rows = await db
    .select()
    .from(s.trims)
    .where(or(isNotNull(s.trims.sampleId), isNotNull(s.trims.referenceId)));
  return new Map(
    rows.map((row) => [
      (row.sampleId ?? row.referenceId) as string,
      { id: row.id, status: row.status as TrimStatus, startS: row.startS, endS: row.endS, error: row.error },
    ]),
  );
}
