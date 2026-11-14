/**
 * Recurrings: an Expense, an Income or a Transfer that repeats on a day of the
 * month, every N months (Ronda 59, Q10). Each time it is due is an occurrence,
 * keyed by its month; it stays pending from its day until Ivan confirms it
 * (which records the movement) or skips it. Nothing is ever recorded by itself.
 */
import { addDays, addMonths, monthOf, type IsoDate, type IsoMonth } from "./dates";

export const MAX_EVERY_MONTHS = 12;
/** How far back an unresolved occurrence still asks for attention. */
export const OVERDUE_MONTHS = 24;

export function isValidEvery(months: number): boolean {
  return Number.isInteger(months) && months >= 1 && months <= MAX_EVERY_MONTHS;
}

/** Months from `a` to `b`: 1 from November to December, negative backwards. */
export function monthsBetween(a: IsoMonth, b: IsoMonth): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

function lastDayOf(month: IsoMonth): number {
  return Number(addDays(`${addMonths(month, 1)}-01`, -1).slice(8));
}

/**
 * When a Recurring is due in `month`, or null if it isn't due that month. It
 * keeps the day of its first date; a month without that day (the 31st in
 * February) uses its last day.
 */
export function dueDateIn(firstDate: IsoDate, everyMonths: number, month: IsoMonth): IsoDate | null {
  const diff = monthsBetween(monthOf(firstDate), month);
  if (diff < 0 || diff % everyMonths !== 0) return null;
  const day = Math.min(Number(firstDate.slice(8)), lastDayOf(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** "Every month on the 15th", "Every 3 months on the 31st". */
export function scheduleLabel(firstDate: IsoDate, everyMonths: number): string {
  const day = Number(firstDate.slice(8));
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  const every = everyMonths === 1 ? "Every month" : `Every ${everyMonths} months`;
  return `${every} on the ${day}${suffix}`;
}

export type RecurringRule = { id: string; firstDate: IsoDate; everyMonths: number };

/** How an occurrence was settled: the movement it recorded, or null when skipped. */
export type Resolutions = Map<string, string | null>;
export const resolutionKey = (recurringId: string, month: IsoMonth) => `${recurringId}:${month}`;

export type OccurrenceState = "pending" | "upcoming" | "confirmed" | "skipped";
export type Occurrence = {
  recurringId: string;
  month: IsoMonth;
  due: IsoDate;
  /** Pending from its day on; upcoming before it. Both can be confirmed or skipped. */
  state: OccurrenceState;
  movementId: string | null;
};

const ORDER: Record<OccurrenceState, number> = { pending: 0, upcoming: 1, confirmed: 2, skipped: 2 };

/**
 * The occurrences to show for a month. Every occurrence of that month, settled
 * or not; looking at this month, also the unsettled ones of earlier months
 * (Q3). Pending first, the oldest first; then upcoming; then the settled ones.
 */
export function occurrencesFor(
  rules: RecurringRule[],
  resolutions: Resolutions,
  month: IsoMonth,
  today: IsoDate,
): Occurrence[] {
  const result: Occurrence[] = [];
  const current = monthOf(today);

  for (const rule of rules) {
    const occurrence = (m: IsoMonth, due: IsoDate): Occurrence => {
      const key = resolutionKey(rule.id, m);
      if (resolutions.has(key)) {
        const movementId = resolutions.get(key) ?? null;
        return { recurringId: rule.id, month: m, due, state: movementId ? "confirmed" : "skipped", movementId };
      }
      return { recurringId: rule.id, month: m, due, state: due <= today ? "pending" : "upcoming", movementId: null };
    };

    if (month === current) {
      for (let back = OVERDUE_MONTHS; back >= 1; back--) {
        const m = addMonths(month, -back);
        const due = dueDateIn(rule.firstDate, rule.everyMonths, m);
        if (due && !resolutions.has(resolutionKey(rule.id, m))) result.push(occurrence(m, due));
      }
    }
    const due = dueDateIn(rule.firstDate, rule.everyMonths, month);
    if (due) result.push(occurrence(month, due));
  }

  return result.sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.due.localeCompare(b.due));
}

/** The first occurrence still to settle, from its first date on (it may be overdue), or null after a long while. */
export function nextOccurrence(rule: RecurringRule, resolutions: Resolutions): { month: IsoMonth; due: IsoDate } | null {
  let month = monthOf(rule.firstDate);
  for (let i = 0; i < 600; i += rule.everyMonths, month = addMonths(month, rule.everyMonths)) {
    if (!resolutions.has(resolutionKey(rule.id, month))) {
      return { month, due: dueDateIn(rule.firstDate, rule.everyMonths, month)! };
    }
  }
  return null;
}
