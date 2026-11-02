import { describe, expect, it } from "vitest";
import {
  isDayEditable,
  overlapsOn,
  planDayBlockChange,
  planStructureEdit,
  planStructureRemoval,
  resolveDayBlocks,
  structureOverlaps,
  type StructureBlock,
  type StructureException,
} from "./structure";

const monday = "2026-11-02";
const deepWork: StructureBlock = {
  id: "b1",
  weekday: 1,
  startMin: 8 * 60,
  endMin: 12 * 60,
  blockTypeId: "deep-work",
  validFrom: "2026-10-01",
  validTo: null,
};
const reading: StructureBlock = {
  id: "b2",
  weekday: 1,
  startMin: 7 * 60 + 30,
  endMin: 8 * 60,
  blockTypeId: "reading",
  validFrom: "2026-10-01",
  validTo: null,
};

describe("resolveDayBlocks", () => {
  it("returns the Structure blocks of that weekday, sorted by time", () => {
    const blocks = resolveDayBlocks([deepWork, reading], [], monday);
    expect(blocks.map((b) => b.blockTypeId)).toEqual(["reading", "deep-work"]);
  });

  it("ignores other weekdays and rows outside their validity window", () => {
    const old = { ...deepWork, id: "old", validTo: "2026-10-31" };
    const tuesday = { ...deepWork, id: "tue", weekday: 2 as const };
    expect(resolveDayBlocks([old, tuesday], [], monday)).toEqual([]);
    expect(resolveDayBlocks([old], [], "2026-10-26")).toHaveLength(1);
  });

  it("applies an Exception that overrides a block on one date only", () => {
    const shorter: StructureException = {
      id: "x1",
      date: monday,
      structureBlockId: "b1",
      removed: false,
      startMin: 9 * 60,
      endMin: 12 * 60,
      blockTypeId: "deep-work",
    };
    const [block] = resolveDayBlocks([deepWork], [shorter], monday);
    expect(block).toMatchObject({ startMin: 540, exceptionId: "x1", structureBlockId: "b1" });
    const [nextWeek] = resolveDayBlocks([deepWork], [shorter], "2026-11-09");
    expect(nextWeek.startMin).toBe(480);
  });

  it("drops a block removed by an Exception and adds one-off blocks", () => {
    const removed: StructureException = {
      id: "x1",
      date: monday,
      structureBlockId: "b1",
      removed: true,
      startMin: 0,
      endMin: 0,
      blockTypeId: "deep-work",
    };
    const added: StructureException = {
      id: "x2",
      date: monday,
      structureBlockId: null,
      removed: false,
      startMin: 14 * 60,
      endMin: 15 * 60,
      blockTypeId: "side-hustle",
    };
    const blocks = resolveDayBlocks([deepWork, reading], [removed, added], monday);
    expect(blocks.map((b) => b.blockTypeId)).toEqual(["reading", "side-hustle"]);
  });
});

describe("editing the Structure applies from today onward", () => {
  it("splits a block that already has history", () => {
    const plan = planStructureEdit(deepWork, { startMin: 9 * 60 }, "2026-10-30");
    expect(plan).toEqual({
      kind: "split",
      close: { id: "b1", validTo: "2026-10-29" },
      insert: {
        weekday: 1,
        startMin: 540,
        endMin: 720,
        blockTypeId: "deep-work",
        validFrom: "2026-10-30",
        validTo: null,
      },
    });
  });

  it("updates in place a block created today or later", () => {
    const fresh = { ...deepWork, validFrom: "2026-10-30" };
    expect(planStructureEdit(fresh, { endMin: 600 }, "2026-10-30")).toEqual({
      kind: "update",
      id: "b1",
      values: { endMin: 600 },
    });
  });

  it("closes old blocks on removal and deletes fresh ones", () => {
    expect(planStructureRemoval(deepWork, "2026-10-30")).toEqual({
      kind: "close",
      id: "b1",
      validTo: "2026-10-29",
    });
    const fresh = { ...deepWork, validFrom: "2026-10-30" };
    expect(planStructureRemoval(fresh, "2026-10-30")).toEqual({ kind: "delete", id: "b1" });
  });
});

describe("overlapping Blocks raise a Warning", () => {
  const gym = { ...reading, id: "b3", blockTypeId: "gym", startMin: 11 * 60, endMin: 13 * 60 };
  const tuesday = { ...deepWork, id: "b4", weekday: 2 as const };

  it("pairs Blocks of the same weekday whose times overlap", () => {
    expect(structureOverlaps([gym, deepWork, reading, tuesday]).map(([a, b]) => [a.id, b.id])).toEqual([
      ["b1", "b3"],
    ]);
  });

  it("does not treat back-to-back Blocks as overlapping", () => {
    expect(structureOverlaps([reading, deepWork])).toEqual([]);
  });

  it("finds what a new range would overlap on a weekday", () => {
    const range = { startMin: 7 * 60, endMin: 9 * 60 };
    expect(overlapsOn([deepWork, reading, tuesday], 1, range).map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(overlapsOn([deepWork, reading, tuesday], 3, range)).toEqual([]);
  });
});

describe("changing one date's Blocks (Exceptions)", () => {
  const [fromStructure] = resolveDayBlocks([deepWork], [], monday);
  const added = {
    date: monday,
    startMin: 18 * 60,
    endMin: 20 * 60,
    blockTypeId: "side-hustle",
    structureBlockId: null,
    exceptionId: "x1",
  };

  it("edits only today and later dates", () => {
    expect(isDayEditable("2026-11-02", "2026-11-02")).toBe(true);
    expect(isDayEditable("2026-11-03", "2026-11-02")).toBe(true);
    expect(isDayEditable("2026-11-01", "2026-11-02")).toBe(false);
  });

  it("reassigns a Structure Block through its Exception, keeping its hours", () => {
    expect(planDayBlockChange(fromStructure, { blockTypeId: "side-hustle" })).toEqual({
      kind: "upsert",
      values: {
        date: monday,
        structureBlockId: "b1",
        removed: false,
        startMin: 480,
        endMin: 720,
        blockTypeId: "side-hustle",
      },
    });
  });

  it("removes a Structure Block for that date only", () => {
    const plan = planDayBlockChange(fromStructure, "remove");
    expect(plan).toMatchObject({ kind: "upsert", values: { structureBlockId: "b1", removed: true } });
    if (plan.kind !== "upsert") throw new Error("expected an upsert");
    const exception = { id: "x9", ...plan.values };
    expect(resolveDayBlocks([deepWork], [exception], monday)).toEqual([]);
    expect(resolveDayBlocks([deepWork], [exception], "2026-11-09")).toHaveLength(1);
  });

  it("edits or deletes a Block added for that date directly", () => {
    expect(planDayBlockChange(added, { blockTypeId: "reading" })).toEqual({
      kind: "update",
      id: "x1",
      values: { startMin: 1080, endMin: 1200, blockTypeId: "reading" },
    });
    expect(planDayBlockChange(added, "remove")).toEqual({ kind: "delete", id: "x1" });
  });
});
