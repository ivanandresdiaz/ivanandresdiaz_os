import { addDays, type IsoDate, startOfWeek, weekdayOf } from "./dates";

/** The Review that can be done: the week it closes and the week it plans (both Mondays). */
export type OpenReview = { week: IsoDate; plans: IsoDate };

/** What the panel shows. "look" and "choose" are the two steps of an open Review. */
export type ReviewStep = "look" | "choose" | "read";

/** A Review opens on Sunday and stays open on Monday. After that it is skipped. */
export function openReview(today: IsoDate): OpenReview | null {
  const weekday = weekdayOf(today);
  if (weekday !== 7 && weekday !== 1) return null;
  const week = weekday === 7 ? startOfWeek(today) : addDays(today, -7);
  return { week, plans: addDays(week, 7) };
}

/** The next Sunday after today: on a Sunday with its Review done, that is a week away. */
export function nextReviewDay(today: IsoDate): IsoDate {
  return addDays(today, 7 - (weekdayOf(today) % 7));
}

export function isFeltScore(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 10;
}

/** Where a request lands. A step that no longer applies falls back to reading. */
export function reviewStep(
  requested: string | undefined,
  week: IsoDate,
  pending: OpenReview | null,
): ReviewStep | null {
  if (requested !== "look" && requested !== "choose" && requested !== "read") return null;
  if (requested === "look" && pending?.week === week) return "look";
  if (requested === "choose" && pending?.plans === week) return "choose";
  return "read";
}

export type FinishedReview = { week: IsoDate; score: number; movesDone: number; movesTotal: number };
export type ReviewRow = ({ status: "done" } & FinishedReview) | { status: "skipped"; week: IsoDate };

/**
 * The history, newest first. It starts at the first finished Review, so the weeks
 * before there were Reviews never show as skipped, and a week still open is not skipped.
 */
export function reviewHistory(finished: FinishedReview[], today: IsoDate): ReviewRow[] {
  if (finished.length === 0) return [];
  const weeks = finished.map((review) => review.week).sort();
  const monday = startOfWeek(today);
  const lastClosed = addDays(monday, today === monday ? -14 : -7);
  const newest = weeks[weeks.length - 1] > lastClosed ? weeks[weeks.length - 1] : lastClosed;

  const rows: ReviewRow[] = [];
  for (let week = newest; week >= weeks[0]; week = addDays(week, -7)) {
    const review = finished.find((candidate) => candidate.week === week);
    rows.push(review ? { status: "done", ...review } : { status: "skipped", week });
  }
  return rows;
}

export type ReviewMove = { moveId: string | null; title: string; done: boolean };

/**
 * The Moves of a week: the ones the last Review saved for it, then the ones chosen
 * for it since. A Move chosen again for a later week stays in the saved list.
 */
export function movesOfWeek(saved: ReviewMove[], chosen: ReviewMove[]): ReviewMove[] {
  const known = new Set(saved.map((move) => move.moveId));
  return [...saved, ...chosen.filter((move) => !known.has(move.moveId))];
}
