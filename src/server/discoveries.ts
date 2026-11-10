import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { Insights, Phase, Stage } from "@/domain/discovery";
import { presignView } from "@/lib/r2";
import { loadInterview } from "./interview-engine";

/** Reads for Ivan's side of the Discoveries. Every page calls requireIvan() before these. */

export async function listDiscoveries() {
  const rows = await db
    .select({
      id: s.discoveries.id,
      title: s.discoveries.title,
      slug: s.discoveries.slug,
      status: s.discoveries.status,
      language: s.discoveries.language,
      createdAt: s.discoveries.createdAt,
      stakeholders: sql<number>`(select count(*)::int from ${s.stakeholders} where ${s.stakeholders.discoveryId} = ${s.discoveries.id} and not ${s.stakeholders.isTest})`,
      themes: sql<number>`(select count(*)::int from ${s.discoveryThemes} where ${s.discoveryThemes.discoveryId} = ${s.discoveries.id})`,
    })
    .from(s.discoveries)
    .orderBy(desc(s.discoveries.createdAt));
  return rows;
}

export type InterviewCell = {
  id: string;
  stage: Stage;
  round: number;
  phase: Phase;
  hasInsights: boolean;
  needs: number;
  proposals: number;
};

export async function getDiscoveryView(id: string) {
  const [discovery] = await db.select().from(s.discoveries).where(eq(s.discoveries.id, id));
  if (!discovery) return null;
  const [images, themes, people] = await Promise.all([
    db.select().from(s.discoveryImages).where(eq(s.discoveryImages.discoveryId, id)).orderBy(asc(s.discoveryImages.position)),
    db.select().from(s.discoveryThemes).where(eq(s.discoveryThemes.discoveryId, id)).orderBy(asc(s.discoveryThemes.position)),
    db.select().from(s.stakeholders).where(eq(s.stakeholders.discoveryId, id)).orderBy(asc(s.stakeholders.createdAt)),
  ]);
  const ids = people.map((p) => p.id);
  const [links, interviews] = ids.length
    ? await Promise.all([
        db.select().from(s.stakeholderThemes).where(inArray(s.stakeholderThemes.stakeholderId, ids)),
        db
          .select({
            id: s.interviews.id,
            stakeholderId: s.interviews.stakeholderId,
            themeId: s.interviews.themeId,
            stage: s.interviews.stage,
            round: s.interviews.round,
            phase: s.interviews.phase,
            insights: s.interviews.insights,
          })
          .from(s.interviews)
          .where(inArray(s.interviews.stakeholderId, ids)),
      ])
    : [[], []];

  const cells: Record<string, InterviewCell> = {};
  for (const i of interviews) {
    const insights = i.insights as Insights | null;
    cells[`${i.stakeholderId}:${i.themeId}`] = {
      id: i.id,
      stage: i.stage as Stage,
      round: i.round,
      phase: i.phase as Phase,
      hasInsights: !!insights,
      needs: insights?.needs.length ?? 0,
      proposals: insights?.proposals.length ?? 0,
    };
  }

  return {
    discovery,
    images: await Promise.all(images.map(async (image) => ({ ...image, url: await presignView(image.key) }))),
    themes,
    stakeholders: people.map((p) => ({
      ...p,
      themeIds: links.filter((l) => l.stakeholderId === p.id).map((l) => l.themeId),
    })),
    cells,
    insights: interviews
      .filter((i) => i.insights)
      .map((i) => ({ id: i.id, stakeholderId: i.stakeholderId, themeId: i.themeId, insights: i.insights as Insights })),
  };
}

export type DiscoveryView = NonNullable<Awaited<ReturnType<typeof getDiscoveryView>>>;

export async function getInterviewView(id: string) {
  const i = await loadInterview(id);
  if (!i) return null;
  return {
    ...i,
    files: await Promise.all(i.files.map(async (f) => ({ ...f, url: await presignView(f.key) }))),
  };
}

export type InterviewView = NonNullable<Awaited<ReturnType<typeof getInterviewView>>>;
