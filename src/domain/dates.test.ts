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
  quarterOf,
  quarterRange,
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
