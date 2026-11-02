import { describe, expect, it } from "vitest";
import {
  addQuarters,
  byPriority,
  firstOpen,
  inPriority,
  landingQuarter,
  parseQuarterKey,
  quarterKey,
  quarterToPlan,
  seasonQuarters,
} from "./plan";

const q = (key: string) => parseQuarterKey(key)!;
const keys = (refs: { year: number; quarter: 1 | 2 | 3 | 4 }[]) => refs.map(quarterKey);

describe("Quarter keys", () => {
  it("round-trips and rejects anything else", () => {
    expect(quarterKey(q("2026-Q4"))).toBe("2026-Q4");
    expect(parseQuarterKey("2026-Q5")).toBeNull();
    expect(parseQuarterKey("backlog")).toBeNull();
    expect(parseQuarterKey(undefined)).toBeNull();
  });

  it("moves across years", () => {
    expect(quarterKey(addQuarters(q("2026-Q4"), 1))).toBe("2027-Q1");
    expect(quarterKey(addQuarters(q("2026-Q1"), -1))).toBe("2025-Q4");
  });
});

describe("the Quarters of a Season", () => {
  const today = "2026-11-02";
  const faithful = { startedOn: "2026-11-01", endedOn: null };
  const microfinance = { startedOn: "2025-02-10", endedOn: "2026-10-31" };
  const existing = ["2025-Q1", "2025-Q3", "2026-Q2", "2026-Q4", "2027-Q1"].map(q);

  it("lists the active Season's Quarters newest first, the next one on top once it exists", () => {
    expect(keys(seasonQuarters(faithful, existing, today))).toEqual(["2027-Q1", "2026-Q4"]);
  });

  it("lists the current Quarter of the active Season before Ivan writes in it", () => {
    expect(keys(seasonQuarters(faithful, [], today))).toEqual(["2026-Q4"]);
  });

  it("shows a Quarter split by two Seasons under both, and skips Quarters never created", () => {
    expect(keys(seasonQuarters(microfinance, existing, today))).toEqual(["2026-Q4", "2026-Q2", "2025-Q3", "2025-Q1"]);
  });

  it("adds the picked Quarter even before it exists, without repeating one", () => {
    expect(keys(seasonQuarters(faithful, [], today, q("2027-Q1")))).toEqual(["2027-Q1", "2026-Q4"]);
    expect(keys(seasonQuarters(faithful, existing, today, q("2026-Q4")))).toEqual(["2027-Q1", "2026-Q4"]);
  });

  it("opens on the current Quarter even when the next one sits above it", () => {
    const listed = seasonQuarters(faithful, existing, today);
    expect(quarterKey(landingQuarter(faithful, listed, today)!)).toBe("2026-Q4");
    expect(quarterKey(landingQuarter(microfinance, seasonQuarters(microfinance, existing, today), today)!)).toBe(
      "2026-Q4",
    );
    expect(landingQuarter({ startedOn: "2024-01-01", endedOn: "2024-06-30" }, [], today)).toBeNull();
  });

  it("offers to plan the next Quarter only while the active Season does not list it", () => {
    expect(quarterKey(quarterToPlan(faithful, seasonQuarters(faithful, [], today), today)!)).toBe("2027-Q1");
    expect(quarterToPlan(faithful, seasonQuarters(faithful, existing, today), today)).toBeNull();
    expect(quarterToPlan(microfinance, [], today)).toBeNull();
  });
});

describe("Campaign priority", () => {
  it("keeps open Campaigns in their order and puts done and dropped ones below", () => {
    const { open, closed } = byPriority([
      { id: "ship", status: "active" as const },
      { id: "old", status: "done" as const },
      { id: "raise", status: "active" as const },
      { id: "gone", status: "dropped" as const },
    ]);
    expect(open.map((c) => c.id)).toEqual(["ship", "raise"]);
    expect(closed.map((c) => c.id)).toEqual(["old", "gone"]);
  });

  it("orders work by its Campaign's priority, then its Move's, keeping Tasks in their order", () => {
    const work = [
      { id: "whatsapp", campaignId: "raise", moveId: "api" },
      { id: "nav", campaignId: "ship", moveId: "ui" },
      { id: "passport", campaignId: null, moveId: null },
      { id: "cartera", campaignId: "raise", moveId: "cartera" },
      { id: "plan", campaignId: "ship", moveId: "ui" },
      { id: "login", campaignId: "ship", moveId: "auth" },
    ];
    const ordered = inPriority(work, (w) => w, { campaigns: ["ship", "raise"], moves: ["auth", "ui", "cartera", "api"] });
    expect(ordered.map((w) => w.id)).toEqual(["login", "nav", "plan", "cartera", "whatsapp", "passport"]);
  });

  it("opens on the first one not done", () => {
    const moves = [
      { id: "done", doneAt: "2026-11-01" },
      { id: "next", doneAt: null },
      { id: "later", doneAt: null },
    ];
    expect(firstOpen(moves, (m) => m.doneAt === null)?.id).toBe("next");
    expect(firstOpen([moves[0]], (m) => m.doneAt === null)).toBeNull();
  });
});
