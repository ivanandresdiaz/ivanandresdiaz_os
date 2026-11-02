import type { IsoDate, Minutes } from "./dates";

/** Strategic work that can be dragged onto the calendar or into a Cycle. */
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

/** Changes a slot's start, keeping its end and at least the minimum duration. */
export function resizeStartTo(
  slot: { startMin: Minutes; endMin: Minutes },
  startMin: Minutes,
): { startMin: Minutes; endMin: Minutes } {
  const start = Math.max(0, Math.min(slot.endMin - MIN_SLOT_MIN, snap(startMin)));
  return { startMin: start, endMin: slot.endMin };
}

/** The range drawn by dragging from one minute to another, in either direction. */
export function drawnRange(from: Minutes, to: Minutes): { startMin: Minutes; endMin: Minutes } {
  const a = snap(from);
  const b = snap(to);
  const start = Math.min(Math.max(0, Math.min(a, b)), DAY_END_MIN - MIN_SLOT_MIN);
  const end = Math.max(Math.min(DAY_END_MIN, Math.max(a, b)), start + MIN_SLOT_MIN);
  return { startMin: start, endMin: end };
}

export const CLICK_RANGE_MIN = 60;

/**
 * The range a single click creates: an hour from the clicked quarter, shrunk
 * to end where the next busy range starts.
 */
export function clickedRange(
  minute: Minutes,
  busy: readonly { startMin: Minutes; endMin: Minutes }[],
): { startMin: Minutes; endMin: Minutes } {
  const start = Math.min(Math.max(0, Math.floor(minute / SNAP_MIN) * SNAP_MIN), DAY_END_MIN - MIN_SLOT_MIN);
  const end = Math.min(
    start + CLICK_RANGE_MIN,
    DAY_END_MIN,
    ...busy.filter((r) => r.startMin >= start + MIN_SLOT_MIN).map((r) => r.startMin),
  );
  return { startMin: start, endMin: end };
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

/**
 * Work still waiting for a place: not done and never put on the calendar.
 * Once placed it lives on the calendar; placed and left unfinished, it comes back as carried over.
 */
export function unplaced<T extends WorkStatus>(work: readonly T[], slots: readonly Slot[]): T[] {
  return work.filter((item) => !item.done && !slots.some((s) => isSlotOf(s, item)));
}

/** Work with a Slot on `date`. */
export function placedOn<T extends WorkRef>(work: readonly T[], slots: readonly Slot[], date: IsoDate): T[] {
  return work.filter((item) => slots.some((s) => s.date === date && isSlotOf(s, item)));
}

function isSlotOf(slot: Slot, work: WorkRef): boolean {
  return slot.work.kind === work.kind && slot.work.id === work.id;
}
