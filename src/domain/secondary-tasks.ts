import type { IsoDate } from "./dates";

export const SECONDARY_TASK_DURATION_MIN = 30;

export type SecondaryTask = {
  id: string;
  title: string;
  createdOn: IsoDate;
  /** The civil date on which it was completed, in Ivan's timezone. */
  doneOn: IsoDate | null;
};

export type SecondaryTaskView = SecondaryTask & {
  done: boolean;
  /** Days it has carried over since its creation; 0 on its first day. */
  carried: number;
};

function daysBetween(start: IsoDate, end: IsoDate): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * One persistent item appears each day from its creation until completion.
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
      if (task.createdOn > date) return [];
      return [{ ...task, done: false, carried: daysBetween(task.createdOn, date) }];
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || b.carried - a.carried);
}
