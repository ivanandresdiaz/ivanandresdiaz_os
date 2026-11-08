import { describe, expect, it } from "vitest";
import {
  activationProblems,
  chapterProgress,
  daysLeft,
  defaultLearningBlock,
  explorationDue,
  explorationEndsOn,
  nextChapter,
  normalizeNoteLink,
} from "./learning-paths";

describe("Activating a Learning Path", () => {
  it("needs a why now, an Infinite Game and a free place", () => {
    expect(activationProblems({ whyNow: "UIF needs tested routes", games: ["Craft"] }, 1)).toEqual([]);
    expect(activationProblems({ whyNow: "  ", games: [] }, 0)).toEqual(["why", "games"]);
    expect(activationProblems({ whyNow: "Now", games: ["Mind"] }, 2)).toEqual(["full"]);
  });
});

describe("The block a Path is played in", () => {
  const blocks = [
    { id: "gym", name: "Gym", kind: "habit" as const, archived: false },
    { id: "old", name: "Learning", kind: "container" as const, archived: true },
    { id: "deep", name: "Deep work for the company", kind: "container" as const, archived: false },
    { id: "sl", name: "Strategic learning", kind: "container" as const, archived: false },
  ];

  it("is the first live Container about learning", () => {
    expect(defaultLearningBlock(blocks)).toBe("sl");
  });

  it("is none when no Container is about learning", () => {
    expect(defaultLearningBlock(blocks.slice(0, 3))).toBeNull();
  });
});

describe("Chapters", () => {
  const chapters = [
    { title: "Basics", done: true },
    { title: "Collections", done: false },
    { title: "CI", done: false },
  ];

  it("go next in order, skipping the done ones", () => {
    expect(nextChapter(chapters)?.title).toBe("Collections");
    expect(nextChapter(chapters.map((c) => ({ ...c, done: true })))).toBeNull();
  });

  it("count how far the Path went", () => {
    expect(chapterProgress(chapters)).toEqual({ done: 1, total: 3 });
  });
});

describe("An Exploration", () => {
  it("ends four weeks after it starts", () => {
    expect(explorationEndsOn("2026-11-07")).toBe("2026-12-05");
  });

  it("asks for its verdict on its last day", () => {
    expect(daysLeft("2026-12-05", "2026-11-07")).toBe(28);
    expect(explorationDue("2026-12-05", "2026-12-04")).toBe(false);
    expect(explorationDue("2026-12-05", "2026-12-05")).toBe(true);
    expect(explorationDue("2026-12-05", "2026-12-20")).toBe(true);
  });
});

describe("A link to the notes", () => {
  it("takes Obsidian and web links", () => {
    expect(normalizeNoteLink(" obsidian://open?vault=notes&file=learn%2Fbruno%2FMISSION ")).toBe(
      "obsidian://open?vault=notes&file=learn%2Fbruno%2FMISSION",
    );
    expect(normalizeNoteLink("https://example.com/course")).toBe("https://example.com/course");
  });

  it("is empty when there is none, and refused when it is not a link", () => {
    expect(normalizeNoteLink("  ")).toBe("");
    expect(normalizeNoteLink("learn/bruno")).toBeNull();
    expect(normalizeNoteLink("javascript:alert(1)")).toBeNull();
    expect(normalizeNoteLink("obsidian://open?file=a b")).toBeNull();
  });
});
