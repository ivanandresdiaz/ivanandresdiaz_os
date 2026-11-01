import { describe, expect, it } from "vitest";
import { FEED_SIZE, feedSeen, pickFeed, rankByLikes } from "./feed";

/** A small deterministic generator so the draws are reproducible. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `r${i + 1}`);

describe("Feed", () => {
  it("holds 10 References, none repeated", () => {
    for (let seed = 1; seed < 50; seed++) {
      const feed = pickFeed(ids(40), new Map(), seeded(seed));
      expect(feed).toHaveLength(FEED_SIZE);
      expect(new Set(feed).size).toBe(FEED_SIZE);
    }
  });

  it("is shorter when there are fewer than 10 References", () => {
    const feed = pickFeed(ids(4), new Map(), seeded(7));
    expect([...feed].sort()).toEqual(ids(4));
    expect(pickFeed([], new Map(), seeded(7))).toEqual([]);
  });

  it("ends with one of the 10 most liked", () => {
    const likes = new Map(ids(10).map((id, i) => [id, 100 - i]));
    const all = ids(60);
    for (let seed = 1; seed < 50; seed++) {
      const feed = pickFeed(all, likes, seeded(seed));
      expect(ids(10)).toContain(feed.at(-1));
      expect(new Set(feed).size).toBe(FEED_SIZE);
    }
  });

  it("draws the first nine from every Reference, not only the most liked", () => {
    const likes = new Map(ids(10).map((id) => [id, 5]));
    const firstNine = new Set<string>();
    for (let seed = 1; seed < 30; seed++)
      pickFeed(ids(60), likes, seeded(seed))
        .slice(0, 9)
        .forEach((id) => firstNine.add(id));
    expect([...firstNine].some((id) => !ids(10).includes(id))).toBe(true);
  });

  it("ignores duplicate ids", () => {
    expect(pickFeed(["a", "a", "b"], new Map(), seeded(3)).sort()).toEqual(["a", "b"]);
  });

  it("ranks by Likes, breaking ties at random", () => {
    const likes = new Map([
      ["a", 3],
      ["b", 9],
      ["c", 3],
    ]);
    const ranked = rankByLikes(["a", "b", "c", "d"], likes, seeded(5));
    expect(ranked[0]).toBe("b");
    expect(ranked.slice(1, 3).sort()).toEqual(["a", "c"]);
    expect(ranked[3]).toBe("d");
  });

  it("never counts more seen than the Feed still holds", () => {
    expect(feedSeen(10, 8)).toBe(8);
    expect(feedSeen(3, 10)).toBe(3);
    expect(feedSeen(-1, 10)).toBe(0);
  });
});
