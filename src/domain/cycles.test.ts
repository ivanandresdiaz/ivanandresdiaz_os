import { describe, expect, it } from "vitest";
import {
  closeAt,
  cyclePhase,
  focusSpanOn,
  isComplete,
  realFocusMin,
  startDelayMin,
  type Cycle,
} from "./cycles";

const at = (iso: string) => new Date(iso);
// 08:12 in Bogotá (UTC-5).
const cycle: Cycle = {
  startedAt: at("2026-11-02T13:12:00Z"),
  endedAt: null,
  focusMin: 90,
  breakMin: 15,
};

describe("cyclePhase", () => {
  it("is in focus until the planned focus ends", () => {
    const phase = cyclePhase(cycle, at("2026-11-02T13:42:00Z"));
    expect(phase).toMatchObject({ phase: "focus", remainingMs: 60 * 60_000 });
    expect(phase.phase === "focus" && phase.progress).toBeCloseTo(1 / 3);
  });

  it("then gives the break, then is over and complete", () => {
    expect(cyclePhase(cycle, at("2026-11-02T14:47:00Z"))).toMatchObject({
      phase: "break",
      remainingMs: 10 * 60_000,
    });
    expect(cyclePhase(cycle, at("2026-11-02T15:00:00Z"))).toEqual({ phase: "over", complete: true });
  });

  it("is over and not complete when closed early", () => {
    const closed = { ...cycle, endedAt: at("2026-11-02T13:30:00Z") };
    expect(cyclePhase(closed, at("2026-11-02T13:31:00Z"))).toEqual({ phase: "over", complete: false });
  });
});

describe("real focus time", () => {
  it("counts until now while running, capped at the planned focus", () => {
    expect(realFocusMin(cycle, at("2026-11-02T13:42:00Z"))).toBe(30);
    expect(realFocusMin(cycle, at("2026-11-02T18:00:00Z"))).toBe(90);
  });

  it("counts until it was closed", () => {
    const closed = { ...cycle, endedAt: at("2026-11-02T13:30:00Z") };
    expect(realFocusMin(closed, at("2026-11-02T18:00:00Z"))).toBe(18);
  });

  it("is complete when closed in the break or less than a minute early", () => {
    expect(isComplete({ ...cycle, endedAt: at("2026-11-02T14:41:30Z") }, at("2026-11-03T00:00:00Z"))).toBe(true);
    expect(isComplete({ ...cycle, endedAt: at("2026-11-02T14:40:00Z") }, at("2026-11-03T00:00:00Z"))).toBe(false);
    expect(isComplete(cycle, at("2026-11-02T13:42:00Z"))).toBe(false);
  });

  it("closing during the break stores the planned focus end", () => {
    expect(closeAt(cycle, at("2026-11-02T14:50:00Z"))).toEqual(at("2026-11-02T14:42:00Z"));
    expect(closeAt(cycle, at("2026-11-02T13:20:00Z"))).toEqual(at("2026-11-02T13:20:00Z"));
  });
});

describe("plan vs reality", () => {
  it("measures how late the focus started against its Slot", () => {
    expect(startDelayMin({ date: "2026-11-02", startMin: 480 }, cycle.startedAt, "America/Bogota")).toBe(12);
    expect(startDelayMin({ date: "2026-11-03", startMin: 480 }, cycle.startedAt, "America/Bogota")).toBeNull();
  });

  it("draws the focus on the calendar day in local time", () => {
    expect(focusSpanOn(cycle, "2026-11-02", at("2026-11-02T18:00:00Z"), "America/Bogota")).toEqual({
      startMin: 492,
      endMin: 582,
    });
    expect(focusSpanOn(cycle, "2026-11-03", at("2026-11-02T18:00:00Z"), "America/Bogota")).toBeNull();
  });

  it("clips a focus that crosses midnight", () => {
    const late: Cycle = { ...cycle, startedAt: at("2026-11-03T04:30:00Z") }; // 23:30
    const now = at("2026-11-03T08:00:00Z");
    expect(focusSpanOn(late, "2026-11-02", now, "America/Bogota")).toEqual({ startMin: 1410, endMin: 1440 });
    expect(focusSpanOn(late, "2026-11-03", now, "America/Bogota")).toEqual({ startMin: 0, endMin: 60 });
  });
});
