import { describe, expect, it } from "vitest";
import { carriedOver, moveTo, resizeTo, snap, type Slot } from "./slots";

const slot = (id: string, date: string, workId: string): Slot => ({
  id,
  date,
  startMin: 480,
  endMin: 540,
  work: { kind: "task", id: workId },
});

describe("calendar geometry", () => {
  it("snaps to 15 minutes", () => {
    expect(snap(487)).toBe(480);
    expect(snap(488)).toBe(495);
  });

  it("moves keeping duration and stays inside the day", () => {
    expect(moveTo({ startMin: 480, endMin: 540 }, 601)).toEqual({ startMin: 600, endMin: 660 });
    expect(moveTo({ startMin: 480, endMin: 540 }, -30)).toEqual({ startMin: 0, endMin: 60 });
    expect(moveTo({ startMin: 480, endMin: 540 }, 1430)).toEqual({ startMin: 1380, endMin: 1440 });
  });

  it("resizes keeping a minimum duration", () => {
    expect(resizeTo({ startMin: 480, endMin: 540 }, 610)).toEqual({ startMin: 480, endMin: 615 });
    expect(resizeTo({ startMin: 480, endMin: 540 }, 400)).toEqual({ startMin: 480, endMin: 495 });
  });
});

describe("carriedOver", () => {
  const today = "2026-10-30";

  it("brings back unfinished work scheduled on past days, counting the days", () => {
    const result = carriedOver(
      [{ kind: "task", id: "t1", done: false }],
      [slot("s1", "2026-10-28", "t1"), slot("s2", "2026-10-29", "t1"), slot("s3", "2026-10-29", "t1")],
      today,
    );
    expect(result).toEqual([{ kind: "task", id: "t1", times: 2, lastDate: "2026-10-29" }]);
  });

  it("ignores done work, work planned again from today on, and never-scheduled work", () => {
    const result = carriedOver(
      [
        { kind: "task", id: "done", done: true },
        { kind: "task", id: "replanned", done: false },
        { kind: "task", id: "unscheduled", done: false },
      ],
      [slot("s1", "2026-10-29", "done"), slot("s2", "2026-10-29", "replanned"), slot("s3", today, "replanned")],
      today,
    );
    expect(result).toEqual([]);
  });

  it("does not confuse a Move and a Task with the same id", () => {
    const result = carriedOver(
      [{ kind: "move", id: "x", done: false }],
      [slot("s1", "2026-10-29", "x")],
      today,
    );
    expect(result).toEqual([]);
  });
});
