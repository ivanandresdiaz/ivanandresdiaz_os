import { describe, expect, it } from "vitest";
import {
  planStructureEdit,
  planStructureRemoval,
  resolveDayBlocks,
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
