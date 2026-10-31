/**
 * Highlights (from Make Time): 1 to 3 things that are critical to get done
 * today because they move the needle. Each one says why.
 */
export const MAX_HIGHLIGHTS = 3;

export type Highlight = {
  title: string;
  why: string;
  done: boolean;
};

export type HighlightProblem = "title-missing" | "why-missing" | "too-many";

export function validateNewHighlight(
  existing: readonly Highlight[],
  candidate: { title: string; why: string },
): HighlightProblem | null {
  if (existing.length >= MAX_HIGHLIGHTS) return "too-many";
  if (candidate.title.trim() === "") return "title-missing";
  if (candidate.why.trim() === "") return "why-missing";
  return null;
}

/** Day Won: every Highlight of the day is done (and there is at least one). */
export function isDayWon(highlights: readonly Highlight[]): boolean {
  return highlights.length > 0 && highlights.every((h) => h.done);
}
