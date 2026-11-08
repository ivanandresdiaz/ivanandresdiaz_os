import "server-only";
import { asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { ContextLearningPath } from "@/domain/context";
import type { IsoDate } from "@/domain/dates";
import { normalizeGames, type InfiniteGame } from "@/domain/infinite-games";
import type { PathStatus } from "@/domain/learning-paths";

export type ChapterView = { id: string; title: string; link: string; weekOf: IsoDate | null; done: boolean };

export type LearningPathView = {
  id: string;
  title: string;
  whyNow: string;
  games: InfiniteGame[];
  status: PathStatus;
  link: string;
  block: { id: string; name: string; color: string } | null;
  campaigns: { id: string; title: string }[];
  chapters: ChapterView[];
  closedAt: Date | null;
};

export type ExplorationView = {
  id: string;
  title: string;
  startedOn: IsoDate;
  endsOn: IsoDate;
  verdict: "path" | "drop" | null;
  endedOn: IsoDate | null;
};

/** Every Learning Path with its Chapters in order: Active and Candidates in Ivan's priority, closed ones newest first. */
export async function getLearningPaths(): Promise<LearningPathView[]> {
  const [paths, chapterRows, links, blocks] = await Promise.all([
    db.select().from(s.learningPaths).orderBy(asc(s.learningPaths.position), asc(s.learningPaths.createdAt)),
    db.select().from(s.chapters).orderBy(asc(s.chapters.position), asc(s.chapters.createdAt)),
    db
      .select({ pathId: s.learningPathCampaigns.pathId, id: s.campaigns.id, title: s.campaigns.title })
      .from(s.learningPathCampaigns)
      .innerJoin(s.campaigns, eq(s.campaigns.id, s.learningPathCampaigns.campaignId))
      .orderBy(asc(s.campaigns.position)),
    db.select().from(s.blockTypes),
  ]);
  return paths
    .map((p) => {
      const block = blocks.find((b) => b.id === p.blockTypeId);
      return {
        id: p.id,
        title: p.title,
        whyNow: p.whyNow,
        games: normalizeGames(p.games),
        status: p.status,
        link: p.link,
        block: block ? { id: block.id, name: block.name, color: block.color } : null,
        campaigns: links.filter((l) => l.pathId === p.id).map(({ id, title }) => ({ id, title })),
        chapters: chapterRows
          .filter((c) => c.pathId === p.id)
          .map((c) => ({ id: c.id, title: c.title, link: c.link, weekOf: c.weekOf, done: c.doneAt !== null })),
        closedAt: p.closedAt,
      };
    })
    .sort((a, b) => {
      const closed = (p: LearningPathView) => p.status === "done" || p.status === "dropped";
      if (closed(a) !== closed(b)) return closed(a) ? 1 : -1;
      if (closed(a)) return (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0);
      return 0;
    });
}

/** The open Exploration first, then the ended ones, newest first. */
export async function getExplorations(): Promise<ExplorationView[]> {
  const rows = await db.select().from(s.explorations).orderBy(desc(s.explorations.startedOn), desc(s.explorations.createdAt));
  const view = rows.map((r): ExplorationView => ({
    id: r.id,
    title: r.title,
    startedOn: r.startedOn,
    endsOn: r.endsOn,
    verdict: r.verdict === "path" || r.verdict === "drop" ? r.verdict : null,
    endedOn: r.endedOn,
  }));
  return [...view.filter((e) => e.verdict === null), ...view.filter((e) => e.verdict !== null)];
}

/** What a Learning Path can be tied to: the Campaigns not closed yet, in priority. */
export async function getOpenCampaigns(): Promise<{ id: string; title: string; status: string }[]> {
  return db
    .select({ id: s.campaigns.id, title: s.campaigns.title, status: s.campaigns.status })
    .from(s.campaigns)
    .where(inArray(s.campaigns.status, ["active", "candidate"]))
    .orderBy(asc(s.campaigns.position), asc(s.campaigns.createdAt));
}

export type WeekChapter = ChapterView & { pathTitle: string; block: { name: string; color: string } | null };

/** The Chapters chosen for a week, in the order of their Paths. */
export async function getChaptersOfWeek(week: IsoDate): Promise<WeekChapter[]> {
  const rows = await db
    .select({ chapter: s.chapters, pathTitle: s.learningPaths.title, blockName: s.blockTypes.name, blockColor: s.blockTypes.color })
    .from(s.chapters)
    .innerJoin(s.learningPaths, eq(s.learningPaths.id, s.chapters.pathId))
    .leftJoin(s.blockTypes, eq(s.blockTypes.id, s.learningPaths.blockTypeId))
    .where(eq(s.chapters.weekOf, week))
    .orderBy(asc(s.learningPaths.position), asc(s.chapters.position));
  return rows.map(({ chapter: c, pathTitle, blockName, blockColor }) => ({
    id: c.id,
    title: c.title,
    link: c.link,
    weekOf: c.weekOf,
    done: c.doneAt !== null,
    pathTitle,
    block: blockName && blockColor ? { name: blockName, color: blockColor } : null,
  }));
}

/** The Active Paths with their open Chapters, for the Weekly Review to choose from. */
export async function getChapterChoices(): Promise<LearningPathView[]> {
  const paths = await getLearningPaths();
  return paths
    .filter((p) => p.status === "active")
    .map((p) => ({ ...p, chapters: p.chapters.filter((c) => !c.done) }));
}

/** The Learning Paths for a Context; the Dropped ones stay out. */
export async function getContextLearningPaths(): Promise<ContextLearningPath[]> {
  const [paths, open] = await Promise.all([
    getLearningPaths(),
    db.select().from(s.explorations).where(isNull(s.explorations.verdict)),
  ]);
  return [
    ...paths
      .filter((p) => p.status !== "dropped")
      .map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status as Exclude<PathStatus, "dropped">,
        whyNow: p.whyNow,
        games: p.games,
        block: p.block?.name ?? null,
        campaigns: p.campaigns.map((c) => c.title),
        chapters: p.chapters.map((c) => ({ title: c.title, done: c.done, weekOf: c.weekOf })),
      })),
    ...open.map((e) => ({
      id: e.id,
      title: e.title,
      status: "exploration" as const,
      whyNow: "",
      games: [],
      block: null,
      campaigns: [],
      chapters: [],
      endsOn: e.endsOn,
    })),
  ];
}

/** How many Paths are Active, leaving one out. */
export async function countActivePaths(except?: string): Promise<number> {
  const rows = await db
    .select({ id: s.learningPaths.id })
    .from(s.learningPaths)
    .where(eq(s.learningPaths.status, "active"));
  return rows.filter((r) => r.id !== except).length;
}
