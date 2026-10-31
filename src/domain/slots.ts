import type { IsoDate, Minutes } from "./dates";

/** What can be dragged onto the calendar: a Task, or a Move without Tasks. */
export type WorkKind = "task" | "move";
export type WorkRef = { kind: WorkKind; id: string };

/** A Task or Move placed on the calendar on one date. */
export type Slot = {
  id: string;
  date: IsoDate;
  startMin: Minutes;
  endMin: Minutes;
  work: WorkRef;
};

export const SNAP_MIN = 15;
export const MIN_SLOT_MIN = 15;
export const DAY_END_MIN = 24 * 60;

export function snap(min: Minutes, step: number = SNAP_MIN): Minutes {
  return Math.round(min / step) * step;
}

/** Moves a slot so it starts at `startMin`, keeping its duration inside the day. */
export function moveTo(
  slot: { startMin: Minutes; endMin: Minutes },
  startMin: Minutes,
): { startMin: Minutes; endMin: Minutes } {
  const duration = slot.endMin - slot.startMin;
  const start = Math.min(Math.max(0, snap(startMin)), DAY_END_MIN - duration);
  return { startMin: start, endMin: start + duration };
}

/** Changes a slot's end, keeping at least the minimum duration. */
export function resizeTo(
  slot: { startMin: Minutes; endMin: Minutes },
  endMin: Minutes,
): { startMin: Minutes; endMin: Minutes } {
  const end = Math.min(
    Math.max(slot.startMin + MIN_SLOT_MIN, snap(endMin)),
    DAY_END_MIN,
  );
  return { startMin: slot.startMin, endMin: end };
}

export type WorkStatus = WorkRef & { done: boolean };

export type CarriedOver = WorkRef & {
  /** How many past days it was scheduled and not finished (×N). */
  times: number;
  lastDate: IsoDate;
};

/**
 * Work that was scheduled, was not done, and has nothing planned from today
 * on. It goes back to the stack each morning, marked ×N.
 */
export function carriedOver(
  work: readonly WorkStatus[],
  slots: readonly Slot[],
  today: IsoDate,
): CarriedOver[] {
  const result: CarriedOver[] = [];
  for (const item of work) {
    if (item.done) continue;
    const own = slots.filter(
      (s) => s.work.kind === item.kind && s.work.id === item.id,
    );
    if (own.some((s) => s.date >= today)) continue;
    const pastDates = [...new Set(own.map((s) => s.date))].sort();
    if (pastDates.length === 0) continue;
    result.push({
      kind: item.kind,
      id: item.id,
      times: pastDates.length,
      lastDate: pastDates[pastDates.length - 1],
    });
  }
  return result.sort((a, b) => b.times - a.times);
}
