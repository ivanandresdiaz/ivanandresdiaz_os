/**
 * Calendar dates as ISO strings ("2026-10-30"). Days are civil days in Ivan's
 * timezone, so the domain never handles Date objects with hidden UTC offsets.
 */
export type IsoDate = string;

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE.test(value)) return false;
  return toIso(fromIso(value)) === value;
}

function fromIso(date: IsoDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = fromIso(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

export function weekdayOf(date: IsoDate): Weekday {
  const day = fromIso(date).getUTCDay();
  return (day === 0 ? 7 : day) as Weekday;
}

/** The Monday that starts the week containing `date`. */
export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, 1 - weekdayOf(date));
}

export function weekDates(date: IsoDate): IsoDate[] {
  const monday = startOfWeek(date);
  return WEEKDAYS.map((_, i) => addDays(monday, i));
}

/** A calendar month, e.g. "2026-11". Only a way to look at days, never a level of the plan. */
export type IsoMonth = string;

const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function isIsoMonth(value: string): value is IsoMonth {
  return ISO_MONTH.test(value);
}

export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

export function addMonths(month: IsoMonth, months: number): IsoMonth {
  const [y, m] = month.split("-").map(Number);
  return monthOf(toIso(new Date(Date.UTC(y, m - 1 + months, 1))));
}

/** "November 2026". */
export function monthLabel(month: IsoMonth): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** The weeks, Monday to Sunday, that cover the month, with the edge days of the months around it. */
export function monthGrid(month: IsoMonth): IsoDate[][] {
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const weeks: IsoDate[][] = [];
  for (let monday = startOfWeek(`${month}-01`); monday <= last; monday = addDays(monday, 7)) {
    weeks.push(weekDates(monday));
  }
  return weeks;
}

/** Today's civil date in the given IANA timezone. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type QuarterNumber = 1 | 2 | 3 | 4;
export type QuarterRef = { year: number; quarter: QuarterNumber };

export function quarterOf(date: IsoDate): QuarterRef {
  const [year, month] = date.split("-").map(Number);
  return { year, quarter: (Math.floor((month - 1) / 3) + 1) as QuarterNumber };
}

export function quarterRange({ year, quarter }: QuarterRef): {
  start: IsoDate;
  end: IsoDate;
} {
  const startMonth = (quarter - 1) * 3 + 1;
  const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const nextStart =
    quarter === 4
      ? `${year + 1}-01-01`
      : `${year}-${String(startMonth + 3).padStart(2, "0")}-01`;
  return { start, end: addDays(nextStart, -1) };
}

export function quarterLabel({ year, quarter }: QuarterRef): string {
  return `Q${quarter} ${year}`;
}

/** Whole days from `from` to `to` (negative when `to` comes first). */
function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((fromIso(to).getTime() - fromIso(from).getTime()) / 86_400_000);
}

/** "October 1 – December 31, 2026". */
export function quarterSpan(ref: QuarterRef): string {
  const { start, end } = quarterRange(ref);
  const day = (date: IsoDate) => {
    const [, m, d] = date.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${d}`;
  };
  return `${day(start)} – ${day(end)}, ${ref.year}`;
}

/**
 * How much of a Quarter is left, as Ivan plans with it. Today counts as left,
 * because the last day of a Quarter is still a day to play. Weeks are the
 * Monday-to-Sunday weeks that touch what is left, this week included, since
 * Campaign work moves one week of Moves at a time.
 */
export type QuarterClock =
  | { phase: "ahead"; startsIn: number; weeks: number }
  | { phase: "running"; daysLeft: number; weeksLeft: number; used: number }
  | { phase: "ended" };

/** The weeks, Monday to Sunday, that touch the days from `from` to `to`. */
function weeksTouching(from: IsoDate, to: IsoDate): number {
  return Math.floor(daysBetween(startOfWeek(from), to) / 7) + 1;
}

export function quarterClock(ref: QuarterRef, today: IsoDate): QuarterClock {
  const { start, end } = quarterRange(ref);
  if (today < start) return { phase: "ahead", startsIn: daysBetween(today, start), weeks: weeksTouching(start, end) };
  if (today > end) return { phase: "ended" };
  const total = daysBetween(start, end) + 1;
  return {
    phase: "running",
    daysLeft: daysBetween(today, end) + 1,
    weeksLeft: weeksTouching(today, end),
    used: daysBetween(start, today) / total,
  };
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** "53 days · 8 weeks left", "Last day", "Starts in 53 days · 14 weeks", "Ended". */
export function quarterClockText(clock: QuarterClock): string {
  switch (clock.phase) {
    case "ahead":
      return `Starts in ${plural(clock.startsIn, "day")} · ${plural(clock.weeks, "week")}`;
    case "running":
      return clock.daysLeft === 1
        ? "Last day"
        : `${plural(clock.daysLeft, "day")} · ${plural(clock.weeksLeft, "week")} left`;
    case "ended":
      return "Ended";
  }
}

/** Where each Monday falls along the Quarter, from 0 (its first day) to 1 (past its last). */
export function quarterWeekMarks(ref: QuarterRef): number[] {
  const { start, end } = quarterRange(ref);
  const total = daysBetween(start, end) + 1;
  const marks: number[] = [];
  for (let monday = addDays(startOfWeek(start), 7); monday <= end; monday = addDays(monday, 7)) {
    marks.push(daysBetween(start, monday) / total);
  }
  return marks;
}

/** Minutes since midnight, e.g. 450 = 07:30. */
export type Minutes = number;

export function formatMinutes(min: Minutes): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseMinutes(hhmm: string): Minutes {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) throw new Error(`Invalid time "${hhmm}"`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m > 0)) {
    throw new Error(`Invalid time "${hhmm}"`);
  }
  return h * 60 + m;
}

/** Where an instant falls in Ivan's day: its civil date and minute of the day. */
export function localMoment(instant: Date, timeZone: string): { date: IsoDate; minute: Minutes } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minute: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** "1h 05m", "45m". */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
