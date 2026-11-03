import { describe, expect, it } from "vitest";
import { dayAfterScheduling, secondaryTaskDate, secondaryTasksForDate, type SecondaryTask } from "./secondary-tasks";

const task = (id: string, day: string, doneOn: string | null = null): SecondaryTask => ({
  id,
  title: id,
  day,
  doneOn,
  upkeep: null,
});

describe("Secondary Tasks", () => {
  it("keeps an unscheduled pending task visible and counts its carry over days", () => {
    expect(secondaryTasksForDate([task("Call the bank", "2026-10-30")], "2026-10-30")).toEqual([
      { ...task("Call the bank", "2026-10-30"), done: false, carried: 0 },
    ]);
    expect(secondaryTasksForDate([task("Call the bank", "2026-10-30")], "2026-11-02")).toEqual([
      { ...task("Call the bank", "2026-10-30"), done: false, carried: 3 },
    ]);
  });

  it("does not duplicate a pending task or show it before its day", () => {
    const result = secondaryTasksForDate([task("one", "2026-10-30")], "2026-10-31");
    expect(result).toHaveLength(1);
    expect(secondaryTasksForDate([task("one", "2026-10-30")], "2026-10-29")).toEqual([]);
  });

  it("stops carrying a completed task and shows it only on its completion day", () => {
    const completed = task("one", "2026-10-28", "2026-10-30");
    expect(secondaryTasksForDate([completed], "2026-10-31")).toEqual([]);
    expect(secondaryTasksForDate([completed], "2026-10-30")).toEqual([
      { ...completed, done: true, carried: 0 },
    ]);
  });

  it("orders carried pending, new pending, then completed tasks", () => {
    const result = secondaryTasksForDate(
      [
        task("new", "2026-10-30"),
        task("done", "2026-10-27", "2026-10-30"),
        task("carried", "2026-10-28"),
      ],
      "2026-10-30",
    );
    expect(result.map((t) => t.id)).toEqual(["carried", "new", "done"]);
  });
});

describe("scheduling a pending Secondary Task", () => {
  const today = "2026-11-02";

  it("postpones it to a future day, as if it were born there", () => {
    // The boss moves the meeting from Tuesday to Thursday.
    expect(dayAfterScheduling("2026-11-03", "2026-11-05", today)).toBe("2026-11-05");
    // Not today, Thursday: one carried over leaves the days it carried over.
    expect(dayAfterScheduling("2026-10-31", "2026-11-05", today)).toBe("2026-11-05");
    const postponed = task("Install Claude Work", "2026-11-05");
    expect(secondaryTasksForDate([postponed], "2026-11-01")).toEqual([]);
    expect(secondaryTasksForDate([postponed], "2026-11-05")[0].carried).toBe(0);
  });

  it("brings it forward to an earlier future day or to today", () => {
    expect(dayAfterScheduling("2026-11-05", "2026-11-03", today)).toBe("2026-11-03");
    expect(dayAfterScheduling("2026-11-05", today, today)).toBe(today);
  });

  it("keeps the day, and the ×N, of one carried over and scheduled today", () => {
    expect(dayAfterScheduling("2026-10-31", today, today)).toBe("2026-10-31");
    expect(dayAfterScheduling(today, today, today)).toBe(today);
  });

  it("changes nothing when the Slot lands on a past day", () => {
    expect(dayAfterScheduling("2026-11-05", "2026-11-01", today)).toBe("2026-11-05");
    expect(dayAfterScheduling("2026-10-31", "2026-11-01", today)).toBe("2026-10-31");
  });
});

describe("a Secondary Task seen from afar", () => {
  it("sits on its day while pending and on the day it was done once completed", () => {
    expect(secondaryTaskDate(task("Call the bank", "2026-10-30"))).toBe("2026-10-30");
    expect(secondaryTaskDate(task("Call the bank", "2026-10-30", "2026-11-02"))).toBe("2026-11-02");
  });
});
