"use server";

import { and, asc, eq, inArray, like, max } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import {
  BRIEF_TEMPLATE,
  discoveryMarkdown,
  discoveryPrefix,
  type ExportTheme,
  type Insights,
  isEmail,
  LANGUAGES,
  LEARN_TEMPLATE,
  MAX_BRIEF,
  MAX_IMAGE_DESCRIPTION,
  MAX_LEARN,
  MAX_OPENING,
  MAX_ROLE_NOTE,
  MAX_THEME_DESCRIPTION,
  MAX_TITLE,
  normalizeEmail,
  openingImageKey,
  slugify,
  validateOpeningImage,
} from "@/domain/discovery";
import { DiscoveryAiError, discoveryAiAvailable, draftOpening } from "@/lib/discovery-ai";
import { deleteObject, objectSize, presignUpload } from "@/lib/r2";
import { requireIvan } from "@/lib/session";
import { conversationText, loadInterview, refreshInsights } from "./interview-engine";
import { endSessionsOf, endSessionsOfStakeholder, startSession } from "./stakeholder-session";
import { titleTag } from "./stakeholder-views";

/**
 * Ivan's side of the Discoveries. Every action starts with requireIvan(): a
 * Stakeholder's session never opens any of these (ADR 0005).
 */

type Outcome<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const title = z.string().trim().min(1).max(MAX_TITLE);
const language = z.enum(LANGUAGES);

async function done() {
  refresh();
}

async function uniqueSlug(base: string) {
  const taken = new Set(
    (await db.select({ slug: s.discoveries.slug }).from(s.discoveries).where(like(s.discoveries.slug, `${base}%`))).map(
      (r) => r.slug,
    ),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

async function requireDiscovery(id: string) {
  const [discovery] = await db.select().from(s.discoveries).where(eq(s.discoveries.id, id));
  if (!discovery) throw new Error("Discovery not found");
  return discovery;
}

// ─── The Discovery ───────────────────────────────────────────────────────────

export async function createDiscovery(input: { title: string; language: string }) {
  await requireIvan();
  const v = z.object({ title, language }).parse(input);
  const [created] = await db
    .insert(s.discoveries)
    .values({ title: v.title, language: v.language, slug: await uniqueSlug(slugify(v.title)), brief: BRIEF_TEMPLATE })
    .returning({ id: s.discoveries.id });
  redirect(`/os/profile/discoveries/${created.id}`);
}

export async function updateDiscovery(input: { id: string; title: string; language: string }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), title, language }).parse(input);
  const [updated] = await db
    .update(s.discoveries)
    .set({ title: v.title, language: v.language })
    .where(eq(s.discoveries.id, v.id))
    .returning({ slug: s.discoveries.slug });
  if (updated) updateTag(titleTag(updated.slug));
  await done();
}

export async function saveBrief(input: { id: string; brief: string }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), brief: z.string().max(MAX_BRIEF) }).parse(input);
  await db.update(s.discoveries).set({ brief: v.brief }).where(eq(s.discoveries.id, v.id));
  await done();
}

export async function saveOpening(input: { id: string; opening: string }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), opening: z.string().max(MAX_OPENING) }).parse(input);
  await db.update(s.discoveries).set({ opening: v.opening }).where(eq(s.discoveries.id, v.id));
  await done();
}

/** A draft of the Opening from the Brief and the Themes. Nothing is saved: Ivan edits it first. */
export async function draftOpeningText(input: { id: string }): Promise<Outcome<{ text: string }>> {
  await requireIvan();
  if (!discoveryAiAvailable()) return { ok: false, error: "Set ANTHROPIC_API_KEY to draft." };
  const { id } = z.object({ id: z.uuid() }).parse(input);
  const discovery = await requireDiscovery(id);
  const themes = await db
    .select({ title: s.discoveryThemes.title, description: s.discoveryThemes.description })
    .from(s.discoveryThemes)
    .where(eq(s.discoveryThemes.discoveryId, id))
    .orderBy(asc(s.discoveryThemes.position));
  try {
    const text = await draftOpening({
      brief: discovery.brief,
      themes: themes.map((t) => (t.description ? `${t.title}: ${t.description}` : t.title)),
      language: discovery.language as "es" | "en",
    });
    return { ok: true, text };
  } catch (error) {
    console.error("Opening draft failed", error);
    return { ok: false, error: error instanceof DiscoveryAiError ? error.message : "The AI could not draft it." };
  }
}

/**
 * Opens, closes or reopens. Opening wipes the test Stakeholders (Q43); closing
 * signs everyone out unless Ivan says not to (Q40).
 */
export async function setDiscoveryStatus(input: { id: string; status: "open" | "closed"; signOut?: boolean }) {
  await requireIvan();
  const v = z
    .object({ id: z.uuid(), status: z.enum(["open", "closed"]), signOut: z.boolean().default(true) })
    .parse(input);
  if (v.status === "open") await deleteTestStakeholders(v.id);
  if (v.status === "closed" && v.signOut) await endSessionsOf(v.id);
  await db.update(s.discoveries).set({ status: v.status }).where(eq(s.discoveries.id, v.id));
  await done();
}

async function interviewFileKeys(stakeholderIds: string[]) {
  if (stakeholderIds.length === 0) return [];
  const rows = await db
    .select({ key: s.interviewFiles.key })
    .from(s.interviewFiles)
    .innerJoin(s.interviews, eq(s.interviews.id, s.interviewFiles.interviewId))
    .where(inArray(s.interviews.stakeholderId, stakeholderIds));
  return rows.map((r) => r.key);
}

async function deleteTestStakeholders(discoveryId: string) {
  const tests = await db
    .select({ id: s.stakeholders.id })
    .from(s.stakeholders)
    .where(and(eq(s.stakeholders.discoveryId, discoveryId), eq(s.stakeholders.isTest, true)));
  const ids = tests.map((t) => t.id);
  if (ids.length === 0) return;
  const keys = await interviewFileKeys(ids);
  await db.delete(s.stakeholders).where(inArray(s.stakeholders.id, ids));
  await Promise.all(keys.map((key) => deleteObject(key)));
}

/** Deletes the Discovery and everything in it: Brief, diagrams, Interviews, files (Q29). */
export async function deleteDiscovery(fd: FormData) {
  await requireIvan();
  const id = z.uuid().parse(fd.get("id"));
  const people = await db.select({ id: s.stakeholders.id }).from(s.stakeholders).where(eq(s.stakeholders.discoveryId, id));
  const images = await db.select({ key: s.discoveryImages.key }).from(s.discoveryImages).where(eq(s.discoveryImages.discoveryId, id));
  const keys = [...images.map((i) => i.key), ...(await interviewFileKeys(people.map((p) => p.id)))];
  const [deleted] = await db.delete(s.discoveries).where(eq(s.discoveries.id, id)).returning({ slug: s.discoveries.slug });
  if (deleted) updateTag(titleTag(deleted.slug));
  await Promise.all(keys.filter((key) => key.startsWith(discoveryPrefix(id))).map((key) => deleteObject(key)));
  redirect("/os/profile/discoveries");
}

// ─── Opening diagrams ────────────────────────────────────────────────────────

export async function createOpeningImageUpload(input: {
  discoveryId: string;
  contentType: string;
  size: number;
}): Promise<Outcome<{ key: string; uploadUrl: string }>> {
  await requireIvan();
  const v = z.object({ discoveryId: z.uuid(), contentType: z.string(), size: z.number().int() }).parse(input);
  const problem = validateOpeningImage(v);
  if (problem) return { ok: false, error: problem };
  await requireDiscovery(v.discoveryId);
  const key = openingImageKey(v.discoveryId, crypto.randomUUID(), v.contentType);
  return { ok: true, key, uploadUrl: await presignUpload(key) };
}

export async function confirmOpeningImage(input: { discoveryId: string; key: string; contentType: string }) {
  await requireIvan();
  const v = z
    .object({ discoveryId: z.uuid(), key: z.string().regex(/^[\w/.-]+$/), contentType: z.string() })
    .parse(input);
  if (!v.key.startsWith(`${discoveryPrefix(v.discoveryId)}opening/`)) throw new Error("Key outside the Discovery");
  const size = await objectSize(v.key);
  if (size === null) throw new Error("The upload did not reach storage");
  const problem = validateOpeningImage({ contentType: v.contentType, size });
  if (problem) {
    await deleteObject(v.key);
    throw new Error(problem);
  }
  const [{ last }] = await db
    .select({ last: max(s.discoveryImages.position) })
    .from(s.discoveryImages)
    .where(eq(s.discoveryImages.discoveryId, v.discoveryId));
  await db
    .insert(s.discoveryImages)
    .values({ discoveryId: v.discoveryId, key: v.key, contentType: v.contentType, sizeBytes: size, position: (last ?? -1) + 1 })
    .onConflictDoNothing();
  await done();
}

export async function describeOpeningImage(input: { id: string; description: string }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), description: z.string().trim().max(MAX_IMAGE_DESCRIPTION) }).parse(input);
  await db.update(s.discoveryImages).set({ description: v.description }).where(eq(s.discoveryImages.id, v.id));
  await done();
}

export async function deleteOpeningImage(fd: FormData) {
  await requireIvan();
  const id = z.uuid().parse(fd.get("id"));
  const [image] = await db.delete(s.discoveryImages).where(eq(s.discoveryImages.id, id)).returning();
  if (image) await deleteObject(image.key);
  await done();
}

// ─── Themes ──────────────────────────────────────────────────────────────────

export async function createTheme(input: { discoveryId: string; title: string }) {
  await requireIvan();
  const v = z.object({ discoveryId: z.uuid(), title }).parse(input);
  await requireDiscovery(v.discoveryId);
  const [{ last }] = await db
    .select({ last: max(s.discoveryThemes.position) })
    .from(s.discoveryThemes)
    .where(eq(s.discoveryThemes.discoveryId, v.discoveryId));
  const [theme] = await db
    .insert(s.discoveryThemes)
    .values({ discoveryId: v.discoveryId, title: v.title, learn: LEARN_TEMPLATE, position: (last ?? -1) + 1 })
    .returning({ id: s.discoveryThemes.id });
  // Every Stakeholder sees every Theme by default (Q13).
  const people = await db.select({ id: s.stakeholders.id }).from(s.stakeholders).where(eq(s.stakeholders.discoveryId, v.discoveryId));
  if (people.length) {
    await db.insert(s.stakeholderThemes).values(people.map((p) => ({ stakeholderId: p.id, themeId: theme.id }))).onConflictDoNothing();
  }
  await done();
}

export async function updateTheme(input: { id: string; title: string; description: string; learn: string }) {
  await requireIvan();
  const v = z
    .object({
      id: z.uuid(),
      title,
      description: z.string().trim().max(MAX_THEME_DESCRIPTION),
      learn: z.string().max(MAX_LEARN),
    })
    .parse(input);
  await db
    .update(s.discoveryThemes)
    .set({ title: v.title, description: v.description, learn: v.learn })
    .where(eq(s.discoveryThemes.id, v.id));
  await done();
}

export async function moveTheme(input: { id: string; direction: -1 | 1 }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), direction: z.union([z.literal(-1), z.literal(1)]) }).parse(input);
  const [theme] = await db.select().from(s.discoveryThemes).where(eq(s.discoveryThemes.id, v.id));
  if (!theme) return;
  const siblings = await db
    .select()
    .from(s.discoveryThemes)
    .where(eq(s.discoveryThemes.discoveryId, theme.discoveryId))
    .orderBy(asc(s.discoveryThemes.position));
  const index = siblings.findIndex((t) => t.id === v.id);
  const other = siblings[index + v.direction];
  if (!other) return;
  const order = [...siblings];
  [order[index], order[index + v.direction]] = [other, theme];
  await db.transaction(async (tx) => {
    for (const [position, t] of order.entries()) {
      await tx.update(s.discoveryThemes).set({ position }).where(eq(s.discoveryThemes.id, t.id));
    }
  });
  await done();
}

export async function deleteTheme(fd: FormData) {
  await requireIvan();
  const id = z.uuid().parse(fd.get("id"));
  const files = await db
    .select({ key: s.interviewFiles.key })
    .from(s.interviewFiles)
    .innerJoin(s.interviews, eq(s.interviews.id, s.interviewFiles.interviewId))
    .where(eq(s.interviews.themeId, id));
  await db.delete(s.discoveryThemes).where(eq(s.discoveryThemes.id, id));
  await Promise.all(files.map((f) => deleteObject(f.key)));
  await done();
}

// ─── Stakeholders ────────────────────────────────────────────────────────────

const person = z
  .object({
    name: z.string().trim().min(1).max(MAX_TITLE),
    roleNote: z.string().trim().max(MAX_ROLE_NOTE),
    wantsNeeds: z.boolean(),
    wantsVision: z.boolean(),
    themeIds: z.array(z.uuid()),
  })
  .refine((p) => p.wantsNeeds || p.wantsVision, "Ask for Needs, Vision or both");

const email = z
  .string()
  .transform(normalizeEmail)
  .refine(isEmail, "Not an email address");

async function setThemes(stakeholderId: string, discoveryId: string, themeIds: string[]) {
  const valid = (
    await db.select({ id: s.discoveryThemes.id }).from(s.discoveryThemes).where(eq(s.discoveryThemes.discoveryId, discoveryId))
  ).map((t) => t.id);
  const chosen = themeIds.filter((id) => valid.includes(id));
  await db.transaction(async (tx) => {
    await tx.delete(s.stakeholderThemes).where(eq(s.stakeholderThemes.stakeholderId, stakeholderId));
    if (chosen.length) await tx.insert(s.stakeholderThemes).values(chosen.map((themeId) => ({ stakeholderId, themeId })));
  });
}

export async function createStakeholder(input: {
  discoveryId: string;
  name: string;
  email: string;
  roleNote: string;
  wantsNeeds: boolean;
  wantsVision: boolean;
  themeIds: string[];
}): Promise<Outcome> {
  await requireIvan();
  const parsed = person.and(z.object({ discoveryId: z.uuid(), email })).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const v = parsed.data;
  await requireDiscovery(v.discoveryId);
  const [created] = await db
    .insert(s.stakeholders)
    .values({
      discoveryId: v.discoveryId,
      name: v.name,
      email: v.email,
      roleNote: v.roleNote,
      wantsNeeds: v.wantsNeeds,
      wantsVision: v.wantsVision,
    })
    .onConflictDoNothing()
    .returning({ id: s.stakeholders.id });
  if (!created) return { ok: false, error: "That email is already invited." };
  await setThemes(created.id, v.discoveryId, v.themeIds);
  await done();
  return { ok: true };
}

export async function updateStakeholder(input: {
  id: string;
  name: string;
  email: string;
  roleNote: string;
  wantsNeeds: boolean;
  wantsVision: boolean;
  themeIds: string[];
}): Promise<Outcome> {
  await requireIvan();
  const parsed = person.and(z.object({ id: z.uuid(), email })).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the fields." };
  const v = parsed.data;
  const [existing] = await db.select().from(s.stakeholders).where(eq(s.stakeholders.id, v.id));
  if (!existing || existing.isTest) return { ok: false, error: "Stakeholder not found." };
  try {
    await db
      .update(s.stakeholders)
      .set({ name: v.name, email: v.email, roleNote: v.roleNote, wantsNeeds: v.wantsNeeds, wantsVision: v.wantsVision })
      .where(eq(s.stakeholders.id, v.id));
  } catch {
    return { ok: false, error: "That email is already invited." };
  }
  if (existing.email !== v.email) await endSessionsOfStakeholder(v.id);
  await setThemes(v.id, existing.discoveryId, v.themeIds);
  await done();
  return { ok: true };
}

/** Cuts a Stakeholder's access; what they said stays (Q29). */
export async function setStakeholderAccess(input: { id: string; removed: boolean }) {
  await requireIvan();
  const v = z.object({ id: z.uuid(), removed: z.boolean() }).parse(input);
  await db.update(s.stakeholders).set({ removedAt: v.removed ? new Date() : null }).where(eq(s.stakeholders.id, v.id));
  if (v.removed) await endSessionsOfStakeholder(v.id);
  await done();
}

/** Deletes a Stakeholder with everything they said and attached. */
export async function deleteStakeholder(fd: FormData) {
  await requireIvan();
  const id = z.uuid().parse(fd.get("id"));
  const keys = await interviewFileKeys([id]);
  await db.delete(s.stakeholders).where(eq(s.stakeholders.id, id));
  await Promise.all(keys.map((key) => deleteObject(key)));
  await done();
}

/** Ivan plays a Stakeholder of a Draft: the real experience, wiped when it opens (Q43). */
export async function startTestInterview(input: {
  discoveryId: string;
  name: string;
  roleNote: string;
  wantsNeeds: boolean;
  wantsVision: boolean;
  themeIds: string[];
}) {
  await requireIvan();
  const v = person.and(z.object({ discoveryId: z.uuid() })).parse(input);
  const discovery = await requireDiscovery(v.discoveryId);
  if (discovery.status !== "draft") throw new Error("Only a Draft can be tried");
  const [created] = await db
    .insert(s.stakeholders)
    .values({
      discoveryId: v.discoveryId,
      name: v.name,
      email: null,
      roleNote: v.roleNote,
      wantsNeeds: v.wantsNeeds,
      wantsVision: v.wantsVision,
      isTest: true,
    })
    .returning({ id: s.stakeholders.id });
  await setThemes(created.id, v.discoveryId, v.themeIds);
  await startSession(created.id, discovery.slug);
  redirect(`/d/${discovery.slug}`);
}

// ─── Insights ────────────────────────────────────────────────────────────────

export async function rewriteInsights(input: { interviewId: string }) {
  await requireIvan();
  const { interviewId } = z.object({ interviewId: z.uuid() }).parse(input);
  await refreshInsights(interviewId);
  await done();
}

/** Copy as Markdown (Q45): Insights by Theme and person, files listed, no Brief. */
export async function discoveryExport(input: { id: string; conversations: boolean }): Promise<string> {
  await requireIvan();
  const v = z.object({ id: z.uuid(), conversations: z.boolean() }).parse(input);
  const discovery = await requireDiscovery(v.id);
  const themes = await db
    .select()
    .from(s.discoveryThemes)
    .where(eq(s.discoveryThemes.discoveryId, v.id))
    .orderBy(asc(s.discoveryThemes.position));
  const rows = await db
    .select({ interview: s.interviews, stakeholder: s.stakeholders })
    .from(s.interviews)
    .innerJoin(s.stakeholders, eq(s.stakeholders.id, s.interviews.stakeholderId))
    .where(and(eq(s.stakeholders.discoveryId, v.id), eq(s.stakeholders.isTest, false)))
    .orderBy(asc(s.stakeholders.createdAt));
  const out: ExportTheme[] = [];
  for (const theme of themes) {
    const interviews = [];
    for (const r of rows.filter((row) => row.interview.themeId === theme.id)) {
      const loaded = v.conversations ? await loadInterview(r.interview.id) : null;
      const files = await db
        .select({ name: s.interviewFiles.name })
        .from(s.interviewFiles)
        .where(eq(s.interviewFiles.interviewId, r.interview.id));
      interviews.push({
        stakeholder: r.stakeholder.name,
        role: r.stakeholder.roleNote,
        insights: r.interview.insights as Insights | null,
        files: files.map((f) => f.name),
        conversation: loaded ? conversationText(loaded.turns, loaded.files) : undefined,
      });
    }
    out.push({ title: theme.title, interviews });
  }
  return discoveryMarkdown(discovery.title, out);
}

