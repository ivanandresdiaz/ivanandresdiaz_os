import { describe, expect, it } from "vitest";
import { intervalLabel, isValidInterval, monthMove, nextUpkeepDay } from "./upkeeps";

describe("Upkeeps", () => {
  it("counts the next occurrence from the day it was done", () => {
    expect(nextUpkeepDay("2026-12-13", 90)).toBe("2027-03-13");
    expect(nextUpkeepDay("2026-11-02", 1)).toBe("2026-11-03");
  });

  it("only takes whole days from one day on", () => {
    expect(isValidInterval(90)).toBe(true);
    expect(isValidInterval(0)).toBe(false);
    expect(isValidInterval(1.5)).toBe(false);
    expect(isValidInterval(100_000)).toBe(false);
  });

  it("says the interval in days, with months as a hint", () => {
    expect(intervalLabel(1)).toBe("every day");
    expect(intervalLabel(14)).toBe("every 14 days");
    expect(intervalLabel(30)).toBe("every 30 days (~1 month)");
    expect(intervalLabel(90)).toBe("every 90 days (~3 months)");
    expect(intervalLabel(365)).toBe("every 365 days (~12 months)");
  });
});

describe("Moving in the Month", () => {
  const today = "2026-11-04";

  it("never drops on a lived day", () => {
    expect(monthMove({ slot: null }, "2026-11-03", today)).toBeNull();
  });

  it("moves the day of a task without a Slot, carried over ones too", () => {
    expect(monthMove({ slot: null }, "2026-11-07", today)).toEqual({ kind: "day", date: "2026-11-07" });
    expect(monthMove({ slot: null }, today, today)).toEqual({ kind: "day", date: today });
  });

  it("moves a Slot from today on, keeping its hour", () => {
    expect(monthMove({ slot: { id: "s", date: "2026-11-10" } }, "2026-11-15", today)).toEqual({
      kind: "slot",
      slotId: "s",
      date: "2026-11-15",
    });
    expect(monthMove({ slot: { id: "s", date: "2026-11-10" } }, "2026-11-10", today)).toBeNull();
  });

  it("leaves a past Slot as history and moves only the day", () => {
    expect(monthMove({ slot: { id: "s", date: "2026-11-01" } }, "2026-11-08", today)).toEqual({
      kind: "day",
      date: "2026-11-08",
    });
  });
});
