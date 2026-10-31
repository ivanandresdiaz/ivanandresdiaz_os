import { describe, expect, it } from "vitest";
import {
  addDays,
  formatMinutes,
  isIsoDate,
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
