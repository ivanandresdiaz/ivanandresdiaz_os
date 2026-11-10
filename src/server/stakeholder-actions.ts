"use server";

import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import {
  type Answer,
  type AnswersPayload,
  type FreeTextPayload,
  FILE_TYPES,
  firstName,
  glossaryKeywords,
  interviewFileKey,
  interviewFilePrefix,
  isEmail,
  MAX_ANSWER,
  MAX_PDF_PAGES,
  type Masked,
  maskSensitive,
  nextStage,
  normalizeEmail,
  pdfPageCount,
  ROUNDS,
  type Stage,
  STALE_THINKING_MS,
  stagesFor,
  validateAttachment,
} from "@/domain/discovery";
import { dictationExtension, dictationKey, isDictationKey, MAX_DICTATION_BYTES } from "@/domain/english";
import { aiAvailability, transcribe } from "@/lib/ai";
import { checkFile, discoveryAiAvailable } from "@/lib/discovery-ai";
import { emailAvailable, sendCodeEmail } from "@/lib/email";
import { deleteObject, getObject, objectSize, presignUpload } from "@/lib/r2";
import { currentRound, earlierThemes, loadInterview, nextSeq, refreshInsights, runRound } from "./interview-engine";
import {
  access,
  CODE_ATTEMPTS,
  CODE_MINUTES,
  CODES_PER_HOUR,
  endSession,
  hashCode,
  newCode,
  requireStakeholder,
  sameHash,
  setGoodbye,
  startSession,
} from "./stakeholder-session";

/**
 * The Stakeholder side. Every action takes the Discovery's slug and checks the
 * Stakeholder's own session for it (ADR 0005); none of them reads Ivan's.
 * Errors that the person should read come back as { ok: false, error }.
 */

type Outcome<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const slug = z.string().regex(/^[a-z0-9-]{1,64}$/);

async function done() {
  refresh();
}

// ─── Signing in (Q11) ────────────────────────────────────────────────────────

/** Sends a code when the email is invited; answers the same either way, so the list can't be probed. */
export async function requestCode(input: { slug: string; email: string }): Promise<Outcome> {
  const v = z.object({ slug, email: z.string().max(254).transform(normalizeEmail) }).parse(input);
  if (!isEmail(v.email)) return { ok: false, error: "email" };
  const found = await access(v.slug);
  if (found.kind === "missing" || found.kind === "closed" || found.kind === "draft") return { ok: false, error: "closed" };
  const { discovery } = found;
  if (!emailAvailable()) return { ok: false, error: "email-off" };
  const [invited] = await db
    .select()
    .from(s.stakeholders)
    .where(
      and(
        eq(s.stakeholders.discoveryId, discovery.id),
        eq(s.stakeholders.email, v.email),
        eq(s.stakeholders.isTest, false),
        isNull(s.stakeholders.removedAt),
      ),
    );
  if (!invited) return { ok: true };
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(s.stakeholderCodes)
    .where(
      and(
        eq(s.stakeholderCodes.discoveryId, discovery.id),
        eq(s.stakeholderCodes.email, v.email),
        gt(s.stakeholderCodes.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    );
  if (recent >= CODES_PER_HOUR) return { ok: false, error: "too-many" };
  const code = newCode();
  await db.insert(s.stakeholderCodes).values({
    discoveryId: discovery.id,
    email: v.email,
    codeHash: hashCode(discovery.id, v.email, code),
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
  });
  try {
    await sendCodeEmail({
      to: v.email,
      code,
      discoveryTitle: discovery.title,
      language: discovery.language as "es" | "en",
      minutes: CODE_MINUTES,
    });
  } catch (error) {
    console.error("Code email failed", error);
    return { ok: false, error: "send" };
  }
  return { ok: true };
}

export async function verifyCode(input: { slug: string; email: string; code: string }): Promise<Outcome> {
  const v = z
    .object({ slug, email: z.string().max(254).transform(normalizeEmail), code: z.string().trim().max(12) })
    .parse(input);
  const found = await access(v.slug);
  if (found.kind === "missing" || found.kind === "closed" || found.kind === "draft") return { ok: false, error: "closed" };
  const { discovery } = found;
  const [code] = await db
    .select()
    .from(s.stakeholderCodes)
    .where(
      and(
        eq(s.stakeholderCodes.discoveryId, discovery.id),
        eq(s.stakeholderCodes.email, v.email),
        isNull(s.stakeholderCodes.usedAt),
        gt(s.stakeholderCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(s.stakeholderCodes.createdAt))
    .limit(1);
  if (!code || code.attempts >= CODE_ATTEMPTS) return { ok: false, error: "expired" };
  if (!sameHash(code.codeHash, hashCode(discovery.id, v.email, v.code.replace(/\D/g, "")))) {
    await db.update(s.stakeholderCodes).set({ attempts: code.attempts + 1 }).where(eq(s.stakeholderCodes.id, code.id));
    return { ok: false, error: code.attempts + 1 >= CODE_ATTEMPTS ? "expired" : "wrong" };
  }
  const [stakeholder] = await db
    .select()
    .from(s.stakeholders)
    .where(
      and(
        eq(s.stakeholders.discoveryId, discovery.id),
        eq(s.stakeholders.email, v.email),
        eq(s.stakeholders.isTest, false),
        isNull(s.stakeholders.removedAt),
      ),
    );
  if (!stakeholder) return { ok: false, error: "expired" };
  await db.update(s.stakeholderCodes).set({ usedAt: new Date() }).where(eq(s.stakeholderCodes.id, code.id));
  await startSession(stakeholder.id, v.slug);
  redirect(`/d/${v.slug}`);
}

/**
 * Signs out on this device. Ivan's test Stakeholder goes back to his editor;
 * anyone else gets a goodbye by name, not the email form.
 */
export async function signOutStakeholder(input: { slug: string }) {
  const v = z.object({ slug }).parse(input);
  const found = await access(v.slug);
  await endSession(v.slug);
  if (found.kind === "in" && found.stakeholder.isTest) redirect(`/os/profile/discoveries/${found.discovery.id}`);
  if (found.kind === "in") await setGoodbye(v.slug, firstName(found.stakeholder.name));
  redirect(`/d/${v.slug}`);
}

// ─── Interviews ──────────────────────────────────────────────────────────────

async function ownInterview(slugValue: string, interviewId: string) {
  const { discovery, stakeholder } = await requireStakeholder(slugValue);
  const [interview] = await db
    .select()
    .from(s.interviews)
    .where(and(eq(s.interviews.id, interviewId), eq(s.interviews.stakeholderId, stakeholder.id)));
  if (!interview) throw new Error("Interview not found");
  return { discovery, stakeholder, interview };
}

/** Starts the Interview of a Theme (or returns the one that exists) and writes its first round. */
export async function startInterview(input: { slug: string; themeId: string }) {
  const v = z.object({ slug, themeId: z.uuid() }).parse(input);
  const { stakeholder } = await requireStakeholder(v.slug);
  const [assigned] = await db
    .select()
    .from(s.stakeholderThemes)
    .where(and(eq(s.stakeholderThemes.stakeholderId, stakeholder.id), eq(s.stakeholderThemes.themeId, v.themeId)));
  if (!assigned) throw new Error("Theme not assigned");
  const [created] = await db
    .insert(s.interviews)
    .values({
      stakeholderId: stakeholder.id,
      themeId: v.themeId,
      stage: stagesFor(stakeholder)[0],
      round: 1,
      phase: "thinking",
      earlier: await earlierThemes(stakeholder.id, v.themeId),
    })
    .onConflictDoNothing()
    .returning({ id: s.interviews.id });
  if (created) await runRound(created.id);
  await done();
}

/** Writes the round again after the AI failed or was cut off. */
export async function retryRound(input: { slug: string; interviewId: string }) {
  const v = z.object({ slug, interviewId: z.uuid() }).parse(input);
  const { interview } = await ownInterview(v.slug, v.interviewId);
  const stale = interview.phase === "thinking" && Date.now() - interview.phaseAt.getTime() > STALE_THINKING_MS;
  if (interview.phase !== "failed" && !stale) return;
  const [claimed] = await db
    .update(s.interviews)
    .set({ phase: "thinking", phaseAt: new Date(), error: null })
    .where(and(eq(s.interviews.id, v.interviewId), eq(s.interviews.phase, interview.phase)))
    .returning({ id: s.interviews.id });
  if (claimed) await runRound(v.interviewId);
  await done();
}

const answerSchema = z.object({
  q: z.string().max(40),
  picked: z.array(z.string().max(40)).max(12),
  text: z.string().max(MAX_ANSWER),
  input: z.enum(["text", "voice"]),
  seconds: z.number().min(0).max(24 * 60 * 60),
  skipped: z.boolean(),
});

function maskAll(texts: string[]) {
  const masked = new Set<Masked>();
  const out = texts.map((text) => {
    const r = maskSensitive(text);
    r.masked.forEach((m) => masked.add(m));
    return r.text;
  });
  return { out, masked: [...masked] };
}

/** Attaches the checked files waiting in this Interview to the turn just sent. */
async function attachPending(interviewId: string, turnId: string) {
  await db
    .update(s.interviewFiles)
    .set({ turnId })
    .where(and(eq(s.interviewFiles.interviewId, interviewId), isNull(s.interviewFiles.turnId)));
}

/**
 * Sends a whole round. The next round is written right away; after the last
 * round of a stage (or when the AI wraps up) the closing screen comes instead.
 */
export async function submitAnswers(input: {
  slug: string;
  interviewId: string;
  answers: Answer[];
}): Promise<Outcome<{ masked: Masked[] }>> {
  const v = z.object({ slug, interviewId: z.uuid(), answers: z.array(answerSchema).max(8) }).parse(input);
  const { interview } = await ownInterview(v.slug, v.interviewId);
  if (interview.phase !== "answering") return { ok: false, error: "stale" };
  const loaded = await loadInterview(v.interviewId);
  const round = loaded && currentRound(loaded.turns);
  if (!round) return { ok: false, error: "stale" };
  const known = new Set(round.questions.map((q) => q.id));
  const answers = v.answers.filter((a) => known.has(a.q));
  const { out, masked } = maskAll(answers.map((a) => a.text));
  const payload: AnswersPayload = { answers: answers.map((a, i) => ({ ...a, text: out[i] })), masked };

  const stage = interview.stage as Stage;
  const last = interview.round >= ROUNDS[stage] || round.wrap_up;
  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(s.interviews)
      .set(
        last
          ? { phase: "closing", phaseAt: new Date() }
          : { phase: "thinking", phaseAt: new Date(), round: interview.round + 1 },
      )
      .where(and(eq(s.interviews.id, v.interviewId), eq(s.interviews.phase, "answering")))
      .returning({ id: s.interviews.id });
    if (!row) return false;
    const [turn] = await tx
      .insert(s.interviewTurns)
      .values({ interviewId: v.interviewId, seq: await nextSeq(v.interviewId), kind: "answers", stage, round: interview.round, payload })
      .returning({ id: s.interviewTurns.id });
    await tx
      .update(s.interviewFiles)
      .set({ turnId: turn.id })
      .where(and(eq(s.interviewFiles.interviewId, v.interviewId), isNull(s.interviewFiles.turnId)));
    return true;
  });
  if (!claimed) return { ok: false, error: "stale" };
  after(() => refreshInsights(v.interviewId));
  if (!last) await runRound(v.interviewId);
  await done();
  return { ok: true, masked };
}

const freeText = z.object({ text: z.string().max(MAX_ANSWER), input: z.enum(["text", "voice"]) });

/** The closing of a stage: what they correct or add, then the next stage or the end. */
export async function finishStage(input: {
  slug: string;
  interviewId: string;
  text: string;
  input: "text" | "voice";
}): Promise<Outcome<{ masked: Masked[] }>> {
  const v = freeText.extend({ slug, interviewId: z.uuid() }).parse(input);
  const { stakeholder, interview } = await ownInterview(v.slug, v.interviewId);
  if (interview.phase !== "closing") return { ok: false, error: "stale" };
  const stage = interview.stage as Stage;
  const next = nextStage(stakeholder, stage);
  const { text, masked } = maskSensitive(v.text);
  const payload: FreeTextPayload = { text, input: v.input, masked };
  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(s.interviews)
      .set(next ? { phase: "thinking", phaseAt: new Date(), stage: next, round: 1 } : { phase: "done", phaseAt: new Date() })
      .where(and(eq(s.interviews.id, v.interviewId), eq(s.interviews.phase, "closing")))
      .returning({ id: s.interviews.id });
    if (!row) return false;
    const [turn] = await tx
      .insert(s.interviewTurns)
      .values({ interviewId: v.interviewId, seq: await nextSeq(v.interviewId), kind: "closing", stage, round: interview.round, payload })
      .returning({ id: s.interviewTurns.id });
    await tx
      .update(s.interviewFiles)
      .set({ turnId: turn.id })
      .where(and(eq(s.interviewFiles.interviewId, v.interviewId), isNull(s.interviewFiles.turnId)));
    return true;
  });
  if (!claimed) return { ok: false, error: "stale" };
  after(() => refreshInsights(v.interviewId));
  if (next) await runRound(v.interviewId);
  await done();
  return { ok: true, masked };
}

/** Something more, after the Interview ended (Q27): saved, read by Ivan, no new round. */
export async function addMore(input: {
  slug: string;
  interviewId: string;
  text: string;
  input: "text" | "voice";
}): Promise<Outcome<{ masked: Masked[] }>> {
  const v = freeText.extend({ slug, interviewId: z.uuid() }).parse(input);
  const { interview } = await ownInterview(v.slug, v.interviewId);
  if (interview.phase !== "done") return { ok: false, error: "stale" };
  const { text, masked } = maskSensitive(v.text);
  const pending = await db
    .select({ id: s.interviewFiles.id })
    .from(s.interviewFiles)
    .where(and(eq(s.interviewFiles.interviewId, v.interviewId), isNull(s.interviewFiles.turnId)));
  if (!text.trim() && pending.length === 0) return { ok: false, error: "empty" };
  const [turn] = await db
    .insert(s.interviewTurns)
    .values({
      interviewId: v.interviewId,
      seq: await nextSeq(v.interviewId),
      kind: "more",
      stage: interview.stage,
      round: interview.round,
      payload: { text, input: v.input, masked } satisfies FreeTextPayload,
    })
    .returning({ id: s.interviewTurns.id });
  await attachPending(v.interviewId, turn.id);
  after(() => refreshInsights(v.interviewId));
  await done();
  return { ok: true, masked };
}

// ─── Files (Q32, Q53) ────────────────────────────────────────────────────────

export async function createAttachmentUpload(input: {
  slug: string;
  interviewId: string;
  contentType: string;
  size: number;
}): Promise<Outcome<{ key: string; uploadUrl: string }>> {
  const v = z.object({ slug, interviewId: z.uuid(), contentType: z.string(), size: z.number().int() }).parse(input);
  const { discovery, interview } = await ownInterview(v.slug, v.interviewId);
  if (!discoveryAiAvailable()) return { ok: false, error: "off" };
  const problem = validateAttachment(v);
  if (problem) return { ok: false, error: problem };
  const key = interviewFileKey(discovery.id, interview.id, crypto.randomUUID(), v.contentType);
  return { ok: true, key, uploadUrl: await presignUpload(key) };
}

export type AttachmentResult = { id: string; name: string; contentType: string } | null;

/**
 * Checks an uploaded file for client data before keeping it. A file with
 * personal data is deleted at once and the reason comes back (Q32).
 */
export async function confirmAttachment(input: {
  slug: string;
  interviewId: string;
  key: string;
  contentType: string;
  name: string;
}): Promise<Outcome<{ accepted: boolean; reason: string; file: AttachmentResult }>> {
  const v = z
    .object({
      slug,
      interviewId: z.uuid(),
      key: z.string().regex(/^[\w/.-]+$/),
      contentType: z.string(),
      name: z.string().trim().max(200),
    })
    .parse(input);
  const { discovery, interview } = await ownInterview(v.slug, v.interviewId);
  if (!v.key.startsWith(interviewFilePrefix(discovery.id, interview.id))) throw new Error("Key outside the Interview");
  const size = await objectSize(v.key);
  if (size === null) return { ok: false, error: "upload" };
  const problem = validateAttachment({ contentType: v.contentType, size });
  if (problem) {
    await deleteObject(v.key);
    return { ok: false, error: problem };
  }
  const bytes = await getObject(v.key);
  if (!bytes) return { ok: false, error: "upload" };
  if (FILE_TYPES[v.contentType].kind === "pdf") {
    const pages = pdfPageCount(new Uint8Array(bytes));
    if (pages !== null && pages > MAX_PDF_PAGES) {
      await deleteObject(v.key);
      return { ok: false, error: "pages" };
    }
  }
  try {
    const check = await checkFile({
      base64: Buffer.from(bytes).toString("base64"),
      contentType: v.contentType,
      name: v.name,
      language: discovery.language as "es" | "en",
    });
    if (check.has_personal_data) {
      await deleteObject(v.key);
      return { ok: true, accepted: false, reason: check.reason, file: null };
    }
    const [file] = await db
      .insert(s.interviewFiles)
      .values({
        interviewId: interview.id,
        key: v.key,
        contentType: v.contentType,
        sizeBytes: size,
        name: v.name || `archivo.${FILE_TYPES[v.contentType].ext}`,
        summary: check.summary,
      })
      .returning({ id: s.interviewFiles.id, name: s.interviewFiles.name, contentType: s.interviewFiles.contentType });
    await done();
    return { ok: true, accepted: true, reason: check.reason, file };
  } catch (error) {
    console.error("File check failed", error);
    await deleteObject(v.key);
    return { ok: false, error: "check" };
  }
}

/** Takes back a file that was not sent yet. */
export async function removeAttachment(input: { slug: string; interviewId: string; fileId: string }) {
  const v = z.object({ slug, interviewId: z.uuid(), fileId: z.uuid() }).parse(input);
  await ownInterview(v.slug, v.interviewId);
  const [file] = await db
    .delete(s.interviewFiles)
    .where(
      and(
        eq(s.interviewFiles.id, v.fileId),
        eq(s.interviewFiles.interviewId, v.interviewId),
        isNull(s.interviewFiles.turnId),
      ),
    )
    .returning();
  if (file) await deleteObject(file.key);
  await done();
}

// ─── Voice (Q23): Dictation in the Discovery's language ──────────────────────

export async function createStakeholderDictationUpload(input: {
  slug: string;
  contentType: string;
  size: number;
}): Promise<Outcome<{ key: string; uploadUrl: string }>> {
  const v = z.object({ slug, contentType: z.string(), size: z.number().int().positive() }).parse(input);
  await requireStakeholder(v.slug);
  if (!aiAvailability().dictation) return { ok: false, error: "off" };
  const extension = dictationExtension(v.contentType);
  if (!extension) return { ok: false, error: "format" };
  if (v.size > MAX_DICTATION_BYTES) return { ok: false, error: "size" };
  const key = dictationKey(crypto.randomUUID(), extension);
  return { ok: true, key, uploadUrl: await presignUpload(key) };
}

export async function transcribeStakeholderDictation(input: {
  slug: string;
  key: string;
  contentType: string;
}): Promise<Outcome<{ text: string }>> {
  const v = z.object({ slug, key: z.string(), contentType: z.string() }).parse(input);
  const { discovery } = await requireStakeholder(v.slug);
  if (!isDictationKey(v.key)) throw new Error("Not a Dictation recording");
  const audio = await getObject(v.key);
  if (!audio) return { ok: false, error: "gone" };
  try {
    const text = await transcribe(audio, v.key.slice(v.key.lastIndexOf("/") + 1), v.contentType.split(";")[0], {
      language: discovery.language as "es" | "en",
      keywords: glossaryKeywords(discovery.brief),
    });
    await deleteObject(v.key);
    return { ok: true, text };
  } catch (error) {
    console.error("Stakeholder Dictation failed", error);
    return { ok: false, error: "failed" };
  }
}

export async function discardStakeholderDictation(input: { slug: string; key: string }) {
  const v = z.object({ slug, key: z.string() }).parse(input);
  await requireStakeholder(v.slug);
  if (!isDictationKey(v.key)) throw new Error("Not a Dictation recording");
  await deleteObject(v.key);
}
