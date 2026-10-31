import { localMoment, type IsoDate, type Minutes } from "./dates";

/**
 * A Cycle is one stretch of focus followed by a break (e.g. 90 + 15).
 * It measures real time as a focus aid and for the game; the plan (Blocks
 * and Slots) stays separate. `endedAt` is when the focus stopped: it is
 * null while it runs, and closing early sets it before the planned end.
 */
export type Cycle = {
  startedAt: Date;
  endedAt: Date | null;
  focusMin: number;
  breakMin: number;
};

export type CyclePreset = { name: string; focusMin: number; breakMin: number };

/** Closing a Cycle up to a minute early still counts as complete. */
export const COMPLETION_TOLERANCE_MS = 60_000;

const MS_PER_MIN = 60_000;

export function plannedFocusEnd(cycle: Cycle): Date {
  return new Date(cycle.startedAt.getTime() + cycle.focusMin * MS_PER_MIN);
}

/** When the focus stopped, or stops: closing early, or the planned end. */
export function focusEnd(cycle: Cycle, now: Date): Date {
  const planned = plannedFocusEnd(cycle);
  const end = cycle.endedAt ?? (now < planned ? now : planned);
  return end < planned ? end : planned;
}

export function realFocusMin(cycle: Cycle, now: Date): number {
  return (focusEnd(cycle, now).getTime() - cycle.startedAt.getTime()) / MS_PER_MIN;
}

export function isComplete(cycle: Cycle, now: Date): boolean {
  return (
    focusEnd(cycle, now).getTime() >=
    plannedFocusEnd(cycle).getTime() - COMPLETION_TOLERANCE_MS
  );
}

export type CyclePhase =
  | { phase: "focus"; remainingMs: number; progress: number }
  | { phase: "break"; remainingMs: number; progress: number }
  | { phase: "over"; complete: boolean };

/** Where a Cycle is right now: in focus, in its break, or over. */
export function cyclePhase(cycle: Cycle, now: Date): CyclePhase {
  const focusMs = cycle.focusMin * MS_PER_MIN;
  const breakMs = cycle.breakMin * MS_PER_MIN;
  const elapsed = now.getTime() - cycle.startedAt.getTime();

  if (cycle.endedAt && cycle.endedAt < plannedFocusEnd(cycle)) {
    return { phase: "over", complete: isComplete(cycle, now) };
  }
  if (elapsed < focusMs) {
    return { phase: "focus", remainingMs: focusMs - elapsed, progress: elapsed / focusMs };
  }
  if (elapsed < focusMs + breakMs) {
    const inBreak = elapsed - focusMs;
    return { phase: "break", remainingMs: breakMs - inBreak, progress: inBreak / breakMs };
  }
  return { phase: "over", complete: true };
}

/** What to store when a Cycle is closed now (closing during the break keeps it complete). */
export function closeAt(cycle: Cycle, now: Date): Date {
  return focusEnd(cycle, now);
}

/**
 * How late the focus started against the Slot it was planned in
 * (started 8:12 for an 8:00 Slot → 12). Null when not on the Slot's date.
 */
export function startDelayMin(
  slot: { date: IsoDate; startMin: Minutes },
  startedAt: Date,
  timeZone: string,
): number | null {
  const start = localMoment(startedAt, timeZone);
  return start.date === slot.date ? start.minute - slot.startMin : null;
}

/** A Cycle's focus drawn on the calendar of one day (clipped at midnight). */
export function focusSpanOn(
  cycle: Cycle,
  date: IsoDate,
  now: Date,
  timeZone: string,
): { startMin: Minutes; endMin: Minutes } | null {
  const start = localMoment(cycle.startedAt, timeZone);
  const end = localMoment(focusEnd(cycle, now), timeZone);
  if (start.date > date || end.date < date) return null;
  const startMin = start.date === date ? start.minute : 0;
  const endMin = end.date === date ? end.minute : 24 * 60;
  return { startMin, endMin: Math.max(endMin, startMin + 1) };
}
