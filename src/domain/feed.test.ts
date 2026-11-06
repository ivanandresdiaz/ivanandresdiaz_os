import { describe, expect, it } from "vitest";
import {
  FEED_SIZE,
  feedDone,
  feedSeen,
  likeAverages,
  MAX_DAILY_LIKES,
  pickFeed,
  rankByLikes,
  stepLikes,
  TOP_SIZE,
  topReferences,
} from "./feed";

/** A small deterministic generator so the draws are reproducible. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => `r${i + 1}`);

/** A Like Average over `days` counted days. */
const avg = (average: number, days = 1) => ({ average, days });

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

  it("ends with one of the Top 10", () => {
    const likes = new Map(ids(10).map((id, i) => [id, avg(15 - i)]));
    const all = ids(60);
    for (let seed = 1; seed < 50; seed++) {
      const feed = pickFeed(all, likes, seeded(seed));
      expect(ids(10)).toContain(feed.at(-1));
      expect(new Set(feed).size).toBe(FEED_SIZE);
    }
  });

  it("draws the first nine from every Reference, not only the Top 10", () => {
    const likes = new Map(ids(10).map((id) => [id, avg(5)]));
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

  it("ranks by Like Average, then by more counted days, then at random", () => {
    const likes = new Map([
      ["a", avg(3, 2)],
      ["b", avg(9, 1)],
      ["c", avg(3, 2)],
      ["d", avg(3, 5)],
    ]);
    const ranked = rankByLikes(["a", "b", "c", "d", "e"], likes, seeded(5));
    expect(ranked.slice(0, 2)).toEqual(["b", "d"]);
    expect(ranked.slice(2, 4).sort()).toEqual(["a", "c"]);
    expect(ranked[4]).toBe("e");
  });

  it("lets a single strong day outrank a long good run", () => {
    const likes = new Map([
      ["steady", avg(12.4, 30)],
      ["new", avg(15, 1)],
    ]);
    expect(rankByLikes(["steady", "new"], likes, seeded(1))).toEqual(["new", "steady"]);
  });

  it("gives up to 15 Likes a day to a Reference and takes back only down to none", () => {
    expect(MAX_DAILY_LIKES).toBe(15);
    expect(stepLikes(0, 1)).toBe(1);
    expect(stepLikes(14, 1)).toBe(MAX_DAILY_LIKES);
    expect(stepLikes(MAX_DAILY_LIKES, 1)).toBe(MAX_DAILY_LIKES);
    expect(stepLikes(3, -1)).toBe(2);
    expect(stepLikes(0, -1)).toBe(0);
  });

  it("never counts more seen than the Feed still holds", () => {
    expect(feedSeen(10, 8)).toBe(8);
    expect(feedSeen(3, 10)).toBe(3);
    expect(feedSeen(-1, 10)).toBe(0);
  });

  it("is done once the last Reference was reached, and an empty Feed never is", () => {
    expect(feedDone(9, 10)).toBe(false);
    expect(feedDone(10, 10)).toBe(true);
    expect(feedDone(0, 0)).toBe(false);
  });
});

describe("Like Average", () => {
  const day = (date: string, referenceIds: string[], seen = referenceIds.length) => ({ date, referenceIds, seen });
  const like = (referenceId: string, date: string, count: number) => ({ referenceId, date, count });

  it("averages the Likes over the days they were given", () => {
    const likes = [like("a", "2026-11-01", 5), like("a", "2026-11-02", 5), like("a", "2026-11-03", 5)];
    expect(likeAverages([], likes).get("a")).toEqual({ average: 5, days: 3 });
  });

  it("counts a day in the Feed without Likes as 0", () => {
    const feeds = [day("2026-11-01", ["a"]), day("2026-11-02", ["a"]), day("2026-11-03", ["a"])];
    expect(likeAverages(feeds, [like("a", "2026-11-01", 15)]).get("a")).toEqual({ average: 5, days: 3 });
  });

  it("leaves out the References the Feed never reached that day", () => {
    const averages = likeAverages([day("2026-11-01", ["a", "b", "c"], 2)], []);
    expect(averages.get("b")).toEqual({ average: 0, days: 1 });
    expect(averages.has("c")).toBe(false);
  });

  it("counts a day once when a Reference was both reached and liked", () => {
    const averages = likeAverages([day("2026-11-01", ["a"])], [like("a", "2026-11-01", 8)]);
    expect(averages.get("a")).toEqual({ average: 8, days: 1 });
  });

  it("counts a day of Likes given outside the Feed, as in the Top 10", () => {
    const averages = likeAverages([day("2026-11-01", ["b"])], [like("a", "2026-11-01", 6)]);
    expect(averages.get("a")).toEqual({ average: 6, days: 1 });
  });
});

describe("Top 10", () => {
  it("holds the 10 highest Like Averages, best first", () => {
    const likes = new Map(ids(12).map((id, i) => [id, avg(i + 1)]));
    const top = topReferences(likes);
    expect(top).toHaveLength(TOP_SIZE);
    expect(top[0]).toBe("r12");
    expect(top.at(-1)).toBe("r3");
  });

  it("leaves out References that never earned a Like", () => {
    const likes = new Map([
      ["seen", avg(0, 4)],
      ["liked", avg(0.7, 21)],
    ]);
    expect(topReferences(likes)).toEqual(["liked"]);
  });

  it("keeps the same order every time it is read", () => {
    const likes = new Map([
      ["b", avg(5, 2)],
      ["a", avg(5, 2)],
      ["c", avg(5, 2)],
    ]);
    expect(topReferences(likes)).toEqual(["a", "b", "c"]);
    expect(topReferences(new Map([...likes].reverse()))).toEqual(["a", "b", "c"]);
  });
});
