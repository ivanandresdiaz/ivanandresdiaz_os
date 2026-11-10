import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  formatDuration,
  formatMinutes,
  isIsoDate,
  isIsoMonth,
  localMoment,
  monthGrid,
  monthLabel,
  monthOf,
  parseMinutes,
  quarterClock,
  quarterClockText,
  quarterOf,
  quarterRange,
  quarterSpan,
  quarterWeekMarks,
  startOfWeek,
  todayIn,
  weekDates,
  weekdayOf,
} from "./dates";

describe("dates", () => {
  it("validates ISO dates", () => {
    expect(isIsoDate("2026-10-30")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("30/10/2026")).toBe(false);
  });

  it("adds days across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("uses ISO weekdays with Monday as day 1", () => {
    expect(weekdayOf("2026-10-26")).toBe(1);
    expect(weekdayOf("2026-11-01")).toBe(7);
  });

  it("starts weeks on Monday", () => {
    expect(startOfWeek("2026-10-30")).toBe("2026-10-26");
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26");
    expect(startOfWeek("2026-10-26")).toBe("2026-10-26");
    expect(weekDates("2026-10-30")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("computes today in Ivan's timezone, not UTC", () => {
    // 02:00 UTC on Oct 31 is still Oct 30 in Bogotá (UTC-5).
    const now = new Date("2026-10-31T02:00:00Z");
    expect(todayIn("America/Bogota", now)).toBe("2026-10-30");
    expect(todayIn("UTC", now)).toBe("2026-10-31");
  });

  it("maps dates to calendar quarters", () => {
    expect(quarterOf("2026-10-30")).toEqual({ year: 2026, quarter: 4 });
    expect(quarterOf("2026-03-31")).toEqual({ year: 2026, quarter: 1 });
    expect(quarterRange({ year: 2026, quarter: 4 })).toEqual({
      start: "2026-10-01",
      end: "2026-12-31",
    });
    expect(quarterRange({ year: 2026, quarter: 1 })).toEqual({
      start: "2026-01-01",
      end: "2026-03-31",
    });
  });

  it("spells a Quarter's dates out", () => {
    expect(quarterSpan({ year: 2026, quarter: 4 })).toBe("October 1 – December 31, 2026");
    expect(quarterSpan({ year: 2027, quarter: 1 })).toBe("January 1 – March 31, 2027");
  });

  describe("how much of a Quarter is left", () => {
    const q4 = { year: 2026, quarter: 4 } as const;

    it("counts today as left, in days and in the weeks that touch what is left", () => {
      expect(quarterClock(q4, "2026-11-09")).toEqual({ phase: "running", daysLeft: 53, weeksLeft: 8, used: 39 / 92 });
      expect(quarterClockText(quarterClock(q4, "2026-11-09"))).toBe("53 days · 8 weeks left");
    });

    it("starts with nothing used and the whole first week counted", () => {
      // October 1, 2026 is a Thursday: its week began on September 28.
      expect(quarterClock(q4, "2026-10-01")).toEqual({ phase: "running", daysLeft: 92, weeksLeft: 14, used: 0 });
    });

    it("calls the final day the last day", () => {
      expect(quarterClock(q4, "2026-12-31")).toEqual({ phase: "running", daysLeft: 1, weeksLeft: 1, used: 91 / 92 });
      expect(quarterClockText(quarterClock(q4, "2026-12-31"))).toBe("Last day");
      expect(quarterClockText(quarterClock(q4, "2026-12-30"))).toBe("2 days · 1 week left");
    });

    it("counts down to a Quarter ahead, across the new year, with all its weeks", () => {
      const q1 = { year: 2027, quarter: 1 } as const;
      expect(quarterClock(q1, "2026-11-09")).toEqual({ phase: "ahead", startsIn: 53, weeks: 14 });
      expect(quarterClockText(quarterClock(q1, "2026-11-09"))).toBe("Starts in 53 days · 14 weeks");
      expect(quarterClockText(quarterClock(q1, "2026-12-31"))).toBe("Starts in 1 day · 14 weeks");
    });

    it("says a past Quarter has ended", () => {
      const clock = quarterClock({ year: 2026, quarter: 3 }, "2026-11-09");
      expect(clock).toEqual({ phase: "ended" });
      expect(quarterClockText(clock)).toBe("Ended");
    });

    it("marks where each week starts along the Quarter", () => {
      const marks = quarterWeekMarks(q4);
      expect(marks).toHaveLength(13); // Mondays October 5 … December 28
      expect(marks[0]).toBe(4 / 92);
      expect(marks.at(-1)).toBe(88 / 92);
      // January 1, 2029 is a Monday: no mark sits on the Quarter's first day.
      expect(quarterWeekMarks({ year: 2029, quarter: 1 })[0]).toBe(7 / 90);
    });
  });

  it("formats and parses times of day", () => {
    expect(formatMinutes(450)).toBe("07:30");
    expect(parseMinutes("7:30")).toBe(450);
    expect(parseMinutes("24:00")).toBe(1440);
    expect(() => parseMinutes("25:00")).toThrow();
  });
});

describe("local moments", () => {
  it("places an instant in Ivan's day", () => {
    expect(localMoment(new Date("2026-11-02T13:12:00Z"), "America/Bogota")).toEqual({
      date: "2026-11-02",
      minute: 492,
    });
    expect(formatDuration(65)).toBe("1h 05m");
    expect(formatDuration(45)).toBe("45m");
  });
});

describe("months", () => {
  it("validates and names months", () => {
    expect(isIsoMonth("2026-11")).toBe(true);
    expect(isIsoMonth("2026-13")).toBe(false);
    expect(isIsoMonth("2026-1")).toBe(false);
    expect(isIsoMonth("2026-11-02")).toBe(false);
    expect(monthOf("2026-11-02")).toBe("2026-11");
    expect(monthLabel("2026-11")).toBe("November 2026");
  });

  it("moves across years", () => {
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 3)).toBe("2027-02");
  });

  it("covers the month with whole weeks from Monday to Sunday", () => {
    const november = monthGrid("2026-11");
    expect(november).toHaveLength(6);
    expect(november[0][0]).toBe("2026-10-26");
    expect(november[0][6]).toBe("2026-11-01");
    expect(november.at(-1)?.[6]).toBe("2026-12-06");
    // February 2027 starts on a Monday and ends on a Sunday: exactly 4 weeks.
    const february = monthGrid("2027-02");
    expect(february).toHaveLength(4);
    expect(february[0][0]).toBe("2027-02-01");
    expect(february[3][6]).toBe("2027-02-28");
  });
});
