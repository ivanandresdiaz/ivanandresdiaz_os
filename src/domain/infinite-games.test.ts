import { describe, expect, it } from "vitest";
import { isFork, normalizeGames } from "./infinite-games";

describe("Infinite Games", () => {
  it("keeps known games once, in canonical order", () => {
    expect(normalizeGames(["Mind", "Body", "Mind", "Chess"])).toEqual(["Body", "Mind"]);
  });

  it("calls an input with several games a Fork", () => {
    expect(isFork(["Body", "Mind"])).toBe(true);
    expect(isFork(["Body"])).toBe(false);
  });
});
