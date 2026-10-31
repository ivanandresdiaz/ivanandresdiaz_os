import { describe, expect, it } from "vitest";
import { secondaryTasksForDate, type SecondaryTask } from "./secondary-tasks";

const task = (id: string, createdOn: string, doneOn: string | null = null): SecondaryTask => ({
  id,
  title: id,
  createdOn,
  doneOn,
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

  it("does not duplicate a pending task or show it before its creation", () => {
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
