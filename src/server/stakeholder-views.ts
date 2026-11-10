import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import type { HistoryBlock, InterviewProps } from "@/components/discovery/interview";
import { db } from "@/db";
import * as s from "@/db/schema";
import {
  firstName,
  type AnswersPayload,
  type FreeTextPayload,
  type Language,
  type Phase,
  type Round,
  type Stage,
  STALE_THINKING_MS,
  stagesFor,
} from "@/domain/discovery";
import { presignView } from "@/lib/r2";
import { currentRound, loadInterview, type Turn } from "./interview-engine";
import type { Discovery, Stakeholder } from "./stakeholder-session";

/** Reads for the Stakeholder side. The page has already checked the session with access(). */

export const titleTag = (slug: string) => `discovery-title:${slug}`;

/** The Discovery's name for the browser tab, cached so the page's shell stays instant. */
export async function discoveryTitle(slug: string) {
  "use cache";
  cacheTag(titleTag(slug));
  cacheLife("days");
  const [found] = await db.select({ title: s.discoveries.title }).from(s.discoveries).where(eq(s.discoveries.slug, slug));
  return found?.title ?? null;
}

export type ThemeCard = {
  id: string;
  title: string;
  description: string;
  interview: { stage: Stage; round: number; phase: Phase } | null;
};

/** This person's Themes in Ivan's order, each with its Interview if started. */
async function themeCards(stakeholder: Stakeholder): Promise<ThemeCard[]> {
  const [themes, interviews] = await Promise.all([
    db
      .select({ theme: s.discoveryThemes })
      .from(s.stakeholderThemes)
      .innerJoin(s.discoveryThemes, eq(s.discoveryThemes.id, s.stakeholderThemes.themeId))
      .where(eq(s.stakeholderThemes.stakeholderId, stakeholder.id))
      .orderBy(asc(s.discoveryThemes.position)),
    db.select().from(s.interviews).where(eq(s.interviews.stakeholderId, stakeholder.id)),
  ]);
  return themes.map(({ theme }) => {
    const i = interviews.find((x) => x.themeId === theme.id);
    return {
      id: theme.id,
      title: theme.title,
      description: theme.description,
      interview: i ? { stage: i.stage as Stage, round: i.round, phase: i.phase as Phase } : null,
    };
  });
}

export async function stakeholderHome(discovery: Discovery, stakeholder: Stakeholder) {
  const [images, cards] = await Promise.all([
    db
      .select()
      .from(s.discoveryImages)
      .where(eq(s.discoveryImages.discoveryId, discovery.id))
      .orderBy(asc(s.discoveryImages.position)),
    themeCards(stakeholder),
  ]);
  return {
    opening: discovery.opening,
    images: await Promise.all(
      images.map(async (image) => ({ id: image.id, description: image.description, url: await presignView(image.key) })),
    ),
    themes: cards,
    stages: stagesFor(stakeholder),
  };
}

/** One answer as the person sees it again: what they picked, then what they said. */
function answerText(round: Round, questionId: string, payload: AnswersPayload, otherLabel: string) {
  const a = payload.answers.find((x) => x.q === questionId);
  if (!a || a.skipped) return null;
  const q = round.questions.find((x) => x.id === questionId);
  const picked = a.picked.map((id) => (id === "other" ? otherLabel : (q?.options.find((o) => o.id === id)?.label ?? id)));
  return [picked.join(" · "), a.text.trim()].filter(Boolean).join(" — ") || null;
}

function history(turns: Turn[], fileNames: Map<string, string[]>, otherLabel: string): HistoryBlock[] {
  const out: HistoryBlock[] = [];
  let round: { turn: Turn; payload: Round } | null = null;
  for (const turn of turns) {
    if (turn.kind === "round") round = { turn, payload: turn.payload as Round };
    else if (turn.kind === "answers" && round) {
      const payload = turn.payload as AnswersPayload;
      const r = round.payload;
      out.push({
        kind: "round",
        stage: round.turn.stage as Stage,
        round: round.turn.round,
        intro: r.intro,
        qa: r.questions.map((q) => ({ question: q.text, answer: answerText(r, q.id, payload, otherLabel) })),
      });
      round = null;
    } else if (turn.kind === "closing" || turn.kind === "more") {
      out.push({ kind: turn.kind, text: (turn.payload as FreeTextPayload).text, files: fileNames.get(turn.id) ?? [] });
    }
  }
  return out;
}

/** The Interview screen of one Theme, or null when the Theme isn't this person's. */
export async function stakeholderInterview(
  discovery: Discovery,
  stakeholder: Stakeholder,
  themeId: string,
  otherLabel: string,
): Promise<InterviewProps | null> {
  const [row] = await db
    .select({ theme: s.discoveryThemes, interviewId: s.interviews.id })
    .from(s.stakeholderThemes)
    .innerJoin(s.discoveryThemes, eq(s.discoveryThemes.id, s.stakeholderThemes.themeId))
    .leftJoin(
      s.interviews,
      and(eq(s.interviews.stakeholderId, s.stakeholderThemes.stakeholderId), eq(s.interviews.themeId, s.stakeholderThemes.themeId)),
    )
    .where(and(eq(s.stakeholderThemes.stakeholderId, stakeholder.id), eq(s.stakeholderThemes.themeId, themeId)));
  if (!row) return null;
  const base = {
    language: discovery.language as Language,
    isTest: stakeholder.isTest,
    firstName: firstName(stakeholder.name),
    themes: (await themeCards(stakeholder)).map((t) => ({ id: t.id, title: t.title, done: t.interview?.phase === "done" })),
    theme: { id: row.theme.id, title: row.theme.title, description: row.theme.description },
    stages: stagesFor(stakeholder),
  };
  const i = row.interviewId ? await loadInterview(row.interviewId) : null;
  if (!i) return { slug: discovery.slug, ...base, interview: null, round: null, pending: [], history: [] };

  const fileNames = new Map<string, string[]>();
  for (const f of i.files) if (f.turnId) fileNames.set(f.turnId, [...(fileNames.get(f.turnId) ?? []), f.name]);
  const phase = i.interview.phase as Phase;
  return {
    slug: discovery.slug,
    ...base,
    interview: {
      id: i.interview.id,
      stage: i.interview.stage as Stage,
      round: i.interview.round,
      phase,
      stale: phase === "thinking" && Date.now() - i.interview.phaseAt.getTime() > STALE_THINKING_MS,
      understood: i.interview.understood,
      error: i.interview.error,
    },
    round: phase === "answering" ? currentRound(i.turns) : null,
    pending: i.files.filter((f) => !f.turnId).map((f) => ({ id: f.id, name: f.name, contentType: f.contentType })),
    history: history(i.turns, fileNames, otherLabel),
  };
}
