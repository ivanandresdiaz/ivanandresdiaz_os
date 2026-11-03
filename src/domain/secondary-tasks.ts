import type { IsoDate } from "./dates";
import type { UpkeepRef } from "./upkeeps";

export const SECONDARY_TASK_DURATION_MIN = 30;

export type SecondaryTask = {
  id: string;
  title: string;
  /** The day it shows up in the Check-in from; it carries over from there. */
  day: IsoDate;
  /** The civil date on which it was completed, in Ivan's timezone. */
  doneOn: IsoDate | null;
  /** The Upkeep it is an occurrence of, if any. */
  upkeep: UpkeepRef | null;
};

export type SecondaryTaskView = SecondaryTask & {
  done: boolean;
  /** Days it has carried over since its day; 0 on its day. */
  carried: number;
};

function daysBetween(start: IsoDate, end: IsoDate): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * One persistent item appears each day from its day until completion.
 * Completed items remain visible only on the day they were completed.
 */
export function secondaryTasksForDate(
  tasks: readonly SecondaryTask[],
  date: IsoDate,
): SecondaryTaskView[] {
  return tasks
    .flatMap((task) => {
      if (task.doneOn !== null) {
        return task.doneOn === date ? [{ ...task, done: true, carried: 0 }] : [];
      }
      if (task.day > date) return [];
      return [{ ...task, done: false, carried: daysBetween(task.day, date) }];
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || b.carried - a.carried);
}

/**
 * The day of a pending Secondary Task once it gets a Slot on `slotDate`.
 * Scheduling it on a future day postpones it there, as if it were born that
 * day; scheduling it today brings it forward if its day had not come yet. One
 * already carried over keeps its day, and its ×N, when scheduled today.
 */
export function dayAfterScheduling(day: IsoDate, slotDate: IsoDate, today: IsoDate): IsoDate {
  if (slotDate > today) return slotDate;
  if (slotDate === today && day > today) return today;
  return day;
}

/**
 * The one date a Secondary Task sits on when days are seen from afar (the
 * Month): a pending one on its day, never on the days it carried over; a
 * completed one on the day it was done.
 */
export function secondaryTaskDate(task: Pick<SecondaryTask, "day" | "doneOn">): IsoDate {
  return task.doneOn ?? task.day;
}
