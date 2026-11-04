import { describe, expect, it } from "vitest";
import {
  type FinishedReview,
  isFeltScore,
  movesOfWeek,
  nextReviewDay,
  openReview,
  reviewHistory,
  reviewStep,
} from "./reviews";

describe("When a Weekly Review is open", () => {
  const review = { week: "2026-11-02", plans: "2026-11-09" };

  it("opens on Sunday for the week ending that day", () => {
    expect(openReview("2026-11-08")).toEqual(review);
  });

  it("stays open on Monday, planning the week already started", () => {
    expect(openReview("2026-11-09")).toEqual(review);
  });

  it("is closed from Tuesday to Saturday", () => {
    for (const day of ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]) {
      expect(openReview(day)).toBeNull();
    }
  });

  it("crosses a year", () => {
    expect(openReview("2027-01-03")).toEqual({ week: "2026-12-28", plans: "2027-01-04" });
  });
});

describe("The next Review day", () => {
  it("is the coming Sunday", () => {
    expect(nextReviewDay("2026-11-04")).toBe("2026-11-08");
    expect(nextReviewDay("2026-11-09")).toBe("2026-11-15");
    expect(nextReviewDay("2026-11-07")).toBe("2026-11-08");
  });

  it("is a week away on a Sunday, whose Review is already done", () => {
    expect(nextReviewDay("2026-11-08")).toBe("2026-11-15");
  });
});

describe("The felt score", () => {
  it("is a whole number from 1 to 10", () => {
    expect(isFeltScore(1)).toBe(true);
    expect(isFeltScore(10)).toBe(true);
    expect(isFeltScore(0)).toBe(false);
    expect(isFeltScore(11)).toBe(false);
    expect(isFeltScore(7.5)).toBe(false);
  });
});

describe("Where the panel lands", () => {
  const pending = { week: "2026-11-02", plans: "2026-11-09" };

  it("stays closed unless asked", () => {
    expect(reviewStep(undefined, "2026-11-02", pending)).toBeNull();
    expect(reviewStep("nonsense", "2026-11-02", pending)).toBeNull();
  });

  it("follows the two steps of the pending Review on their weeks", () => {
    expect(reviewStep("look", "2026-11-02", pending)).toBe("look");
    expect(reviewStep("choose", "2026-11-09", pending)).toBe("choose");
  });

  it("only reads when the step does not apply", () => {
    expect(reviewStep("look", "2026-11-09", pending)).toBe("read");
    expect(reviewStep("choose", "2026-11-02", pending)).toBe("read");
    expect(reviewStep("look", "2026-11-02", null)).toBe("read");
    expect(reviewStep("read", "2026-11-02", pending)).toBe("read");
  });
});

describe("The Review history", () => {
  const done = (week: string, score = 7): FinishedReview => ({ week, score, movesDone: 1, movesTotal: 2 });

  it("is empty before the first Review", () => {
    expect(reviewHistory([], "2026-11-04")).toEqual([]);
  });

  it("goes newest first and marks the gaps as skipped", () => {
    const rows = reviewHistory([done("2026-10-19"), done("2026-11-02")], "2026-11-10");
    expect(rows.map((row) => [row.week, row.status])).toEqual([
      ["2026-11-02", "done"],
      ["2026-10-26", "skipped"],
      ["2026-10-19", "done"],
    ]);
  });

  it("never lists weeks before the first Review", () => {
    expect(reviewHistory([done("2026-11-02")], "2026-11-10").at(-1)?.week).toBe("2026-11-02");
  });

  it("marks a week skipped once its Monday has passed", () => {
    const week = (today: string) => reviewHistory([done("2026-10-26")], today).map((row) => row.week);
    expect(week("2026-11-08")).toEqual(["2026-10-26"]);
    expect(week("2026-11-09")).toEqual(["2026-10-26"]);
    expect(week("2026-11-10")).toEqual(["2026-11-02", "2026-10-26"]);
  });

  it("shows a Review finished on Sunday right away", () => {
    expect(reviewHistory([done("2026-11-02")], "2026-11-08").map((row) => row.week)).toEqual(["2026-11-02"]);
  });
});

describe("The Moves of a week", () => {
  const saved = { moveId: "a", title: "SSO login", done: true };

  it("keeps the saved ones first and adds the ones chosen since", () => {
    const later = { moveId: "b", title: "Azure setup", done: false };
    expect(movesOfWeek([saved], [later])).toEqual([saved, later]);
  });

  it("never repeats a Move in both lists", () => {
    expect(movesOfWeek([saved], [{ ...saved, title: "Renamed" }])).toEqual([saved]);
  });

  it("keeps a deleted Move by its saved title", () => {
    const deleted = { moveId: null, title: "Gone", done: false };
    expect(movesOfWeek([deleted], [])).toEqual([deleted]);
  });
});
