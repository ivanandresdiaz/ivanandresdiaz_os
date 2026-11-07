import type { IsoDate } from "./dates";

/**
 * Highlights (from Make Time): 1 to 3 things that are key to get done on a
 * day because they move the needle. A Highlight is a Task or a Move with a
 * Slot that day, chosen with the Slot's star; its why is optional, because the
 * work already comes aligned with its Campaign.
 */
export const MAX_HIGHLIGHTS = 3;

export type Highlight = {
  title: string;
  why: string;
  done: boolean;
};

export type HighlightProblem = "too-many" | "past-day" | "not-scheduled";

/** Whether a piece of work can become a Highlight of `date` (one it is not already). */
export function validateNewHighlight(input: {
  /** Highlights the day already has. */
  count: number;
  date: IsoDate;
  today: IsoDate;
  /** Whether the work has a Slot on that date. */
  scheduled: boolean;
}): HighlightProblem | null {
  if (input.date < input.today) return "past-day";
  if (!input.scheduled) return "not-scheduled";
  if (input.count >= MAX_HIGHLIGHTS) return "too-many";
  return null;
}

/**
 * What happens to a work's Highlight of a day when one of its Slots leaves
 * that day (moved to `to`, or removed when `to` is null):
 * - `stays`: the work still has a Slot that day, so it is still its Highlight;
 * - `moves`: it goes with the Slot to `to`;
 * - `joins`: `to` already has the work as a Highlight, so this one goes away;
 * - `drops`, `drops-past`, `drops-full`: it goes away (Slot removed, past day, day full).
 */
export type HighlightFollow = "stays" | "moves" | "joins" | "drops" | "drops-past" | "drops-full";

export function followSlot(input: {
  /** Slots of the work left on the day the Slot left. */
  slotsLeft: number;
  to: IsoDate | null;
  today: IsoDate;
  /** Highlights `to` already has. */
  toCount: number;
  /** Whether the work is already a Highlight of `to`. */
  toHasIt: boolean;
}): HighlightFollow {
  if (input.slotsLeft > 0) return "stays";
  if (input.to === null) return "drops";
  if (input.toHasIt) return "joins";
  if (input.to < input.today) return "drops-past";
  if (input.toCount >= MAX_HIGHLIGHTS) return "drops-full";
  return "moves";
}

/** Day Won: every Highlight of the day is done (and there is at least one). */
export function isDayWon(highlights: readonly Highlight[]): boolean {
  return highlights.length > 0 && highlights.every((h) => h.done);
}
