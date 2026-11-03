import { addDays, type IsoDate } from "./dates";

/** Days between occurrences when nothing else is said. */
export const DEFAULT_INTERVAL_DAYS = 90;
export const MAX_INTERVAL_DAYS = 3650;

/** What an occurrence needs to know about its Upkeep to ask for the next one. */
export type UpkeepRef = { id: string; intervalDays: number };

export function isValidInterval(days: number): boolean {
  return Number.isInteger(days) && days >= 1 && days <= MAX_INTERVAL_DAYS;
}

/** The next occurrence counts from the day the last one was done, not from the day it was due. */
export function nextUpkeepDay(doneOn: IsoDate, intervalDays: number): IsoDate {
  return addDays(doneOn, intervalDays);
}

/** "every 90 days (~3 months)": the interval is kept in days, months are only a hint. */
export function intervalLabel(days: number): string {
  const base = days === 1 ? "every day" : `every ${days} days`;
  if (days < 28) return base;
  const months = Math.round(days / 30.44);
  return `${base} (~${months} month${months === 1 ? "" : "s"})`;
}

/**
 * Where a pending Secondary Task lands when dragged to `target` in the Month.
 * Only today or later: a lived day's plan is not rewritten. A Slot from today
 * on moves with its hour; one in the past stays as history and only the day
 * of the task moves.
 */
export function monthMove(
  item: { slot: { id: string; date: IsoDate } | null },
  target: IsoDate,
  today: IsoDate,
): { kind: "slot"; slotId: string; date: IsoDate } | { kind: "day"; date: IsoDate } | null {
  if (target < today) return null;
  if (item.slot && item.slot.date >= today) {
    return item.slot.date === target ? null : { kind: "slot", slotId: item.slot.id, date: target };
  }
  return { kind: "day", date: target };
}
