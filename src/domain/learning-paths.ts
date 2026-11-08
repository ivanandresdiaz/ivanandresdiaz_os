import { addDays, type IsoDate } from "./dates";

/**
 * Learning Paths: what Ivan chose to learn, and why now. The lessons live in
 * Obsidian; Ivan OS only chooses and schedules. See learn/LEARNING-WORKFLOW.md
 * in the vault.
 */

export type PathStatus = "candidate" | "active" | "done" | "dropped";

/** At most two Learning Paths are played at once; the Candidates have no limit. */
export const MAX_ACTIVE_PATHS = 2;

/** An Exploration ends four weeks after it starts, unless Ivan picks another date. */
export const EXPLORATION_DAYS = 28;

export const MAX_PATH_TITLE = 200;
export const MAX_WHY_NOW = 2_000;
export const MAX_NOTE_LINK = 2_000;

export type ActivationProblem = "why" | "games" | "full";

/**
 * What keeps a Path from becoming Active: a "why now", at least one Infinite
 * Game, and a free place among the Active ones. `activeOthers` counts the
 * Active Paths other than this one.
 */
export function activationProblems(
  path: { whyNow: string; games: readonly string[] },
  activeOthers: number,
): ActivationProblem[] {
  const problems: ActivationProblem[] = [];
  if (!path.whyNow.trim()) problems.push("why");
  if (path.games.length === 0) problems.push("games");
  if (activeOthers >= MAX_ACTIVE_PATHS) problems.push("full");
  return problems;
}

export function describeProblem(problem: ActivationProblem): string {
  switch (problem) {
    case "why":
      return "Write why it matters now.";
    case "games":
      return "Pick at least one Infinite Game.";
    case "full":
      return `${MAX_ACTIVE_PATHS} Learning Paths are already Active: finish, stop or drop one first.`;
  }
}

/** The Container Block a new Path is played in: the first one about learning, if there is one. */
export function defaultLearningBlock(
  blocks: readonly { id: string; name: string; kind: "habit" | "container"; archived: boolean }[],
): string | null {
  return blocks.find((b) => b.kind === "container" && !b.archived && /learn/i.test(b.name))?.id ?? null;
}

/** The first Chapter not done yet, in the Path's order. */
export function nextChapter<T extends { done: boolean }>(chapters: readonly T[]): T | null {
  return chapters.find((c) => !c.done) ?? null;
}

export function chapterProgress(chapters: readonly { done: boolean }[]): { done: number; total: number } {
  return { done: chapters.filter((c) => c.done).length, total: chapters.length };
}

export function explorationEndsOn(startedOn: IsoDate): IsoDate {
  return addDays(startedOn, EXPLORATION_DAYS);
}

/** Days until an Exploration ends; zero or less means its verdict is due. */
export function daysLeft(endsOn: IsoDate, today: IsoDate): number {
  return Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function explorationDue(endsOn: IsoDate, today: IsoDate): boolean {
  return daysLeft(endsOn, today) <= 0;
}

/**
 * A link to the notes in Obsidian (`obsidian://…`, from "Copy Obsidian URL")
 * or on the web. Empty means none; null means it is not a link at all.
 */
export function normalizeNoteLink(raw: string): string | null {
  const link = raw.trim();
  if (!link) return "";
  if (link.length > MAX_NOTE_LINK || /\s/.test(link)) return null;
  return /^(obsidian|https?):\/\/\S+$/i.test(link) ? link : null;
}

export function isObsidianLink(link: string): boolean {
  return /^obsidian:\/\//i.test(link);
}
