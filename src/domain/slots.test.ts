import { describe, expect, it } from "vitest";
import {
  carriedOver,
  clickedRange,
  drawnRange,
  moveTo,
  placedOn,
  resizeStartTo,
  resizeTo,
  snap,
  type Slot,
  unplaced,
} from "./slots";

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

  it("resizes from the top keeping the end and a minimum duration", () => {
    expect(resizeStartTo({ startMin: 480, endMin: 540 }, 452)).toEqual({ startMin: 450, endMin: 540 });
    expect(resizeStartTo({ startMin: 480, endMin: 540 }, 600)).toEqual({ startMin: 525, endMin: 540 });
    expect(resizeStartTo({ startMin: 30, endMin: 90 }, -40)).toEqual({ startMin: 0, endMin: 90 });
  });
});

describe("drawnRange", () => {
  it("covers the dragged span in either direction, snapped", () => {
    expect(drawnRange(482, 628)).toEqual({ startMin: 480, endMin: 630 });
    expect(drawnRange(628, 482)).toEqual({ startMin: 480, endMin: 630 });
  });

  it("keeps the minimum duration and stays inside the day", () => {
    expect(drawnRange(480, 484)).toEqual({ startMin: 480, endMin: 495 });
    expect(drawnRange(1435, 1500)).toEqual({ startMin: 1425, endMin: 1440 });
    expect(drawnRange(-20, 30)).toEqual({ startMin: 0, endMin: 30 });
  });
});

describe("clickedRange", () => {
  it("is one hour from the clicked quarter", () => {
    expect(clickedRange(490, [])).toEqual({ startMin: 480, endMin: 540 });
  });

  it("shrinks to fit before the next busy range", () => {
    const busy = [
      { startMin: 300, endMin: 360 },
      { startMin: 510, endMin: 720 },
    ];
    expect(clickedRange(485, busy)).toEqual({ startMin: 480, endMin: 510 });
  });

  it("never goes below 15 minutes nor past midnight", () => {
    expect(clickedRange(485, [{ startMin: 490, endMin: 600 }])).toEqual({ startMin: 480, endMin: 540 });
    expect(clickedRange(1430, [])).toEqual({ startMin: 1425, endMin: 1440 });
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

describe("unplaced", () => {
  it("keeps only unfinished work that was never put on the calendar", () => {
    const result = unplaced(
      [
        { kind: "task", id: "waiting", done: false },
        { kind: "task", id: "in-two-months", done: false },
        { kind: "task", id: "carried", done: false },
        { kind: "task", id: "done", done: true },
        { kind: "move", id: "in-two-months", done: false },
      ],
      [slot("s1", "2027-01-05", "in-two-months"), slot("s2", "2026-10-29", "carried")],
    );
    expect(result.map((w) => `${w.kind}:${w.id}`)).toEqual(["task:waiting", "move:in-two-months"]);
  });
});

describe("placedOn", () => {
  it("finds the work with a Slot on that date", () => {
    const work = [
      { kind: "task" as const, id: "today" },
      { kind: "task" as const, id: "later" },
    ];
    const slots = [slot("s1", "2026-10-30", "today"), slot("s2", "2027-01-05", "later")];
    expect(placedOn(work, slots, "2026-10-30")).toEqual([{ kind: "task", id: "today" }]);
  });
});
