import { describe, expect, it } from "vitest";
import {
  creatorForAccount,
  firstPosition,
  normalizeAccount,
  practiceLap,
  sampleKey,
  sampleKindOf,
  samplePrefix,
  validateSampleFile,
} from "./library";

/** A seeded random, so laps are reproducible. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
}

const samples = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

describe("Sample files", () => {
  it("takes images and videos, never audio", () => {
    expect(sampleKindOf("video/mp4")).toBe("video");
    expect(sampleKindOf("image/jpeg")).toBe("image");
    expect(sampleKindOf("audio/mpeg")).toBeNull();
    expect(validateSampleFile({ contentType: "audio/mpeg", size: 10 })).toBe("unsupported-type");
    expect(validateSampleFile({ contentType: "video/mp4", size: 0 })).toBe("empty");
    expect(validateSampleFile({ contentType: "video/mp4", size: 300 * 1024 * 1024 })).toBe("too-large");
    expect(validateSampleFile({ contentType: "video/mp4", size: 10 })).toBeNull();
  });

  it("keeps a Creator's files under its prefix", () => {
    expect(sampleKey("c1", "f1", "video/mp4")).toBe("library/c1/f1.mp4");
    expect(sampleKey("c1", "f1", "video/mp4").startsWith(samplePrefix("c1"))).toBe(true);
    expect(() => sampleKey("c1", "f1", "audio/mpeg")).toThrow();
  });
});

describe("a Clip finds its Creator by account", () => {
  const creators = [
    { id: "x", account: "VendedorX" },
    { id: "y", account: null },
  ];

  it("ignores case and a leading @", () => {
    expect(normalizeAccount(" @VendedorX ")).toBe("vendedorx");
    expect(creatorForAccount(creators, "@vendedorx")?.id).toBe("x");
  });

  it("finds nothing for an unknown or missing account", () => {
    expect(creatorForAccount(creators, "someone")).toBeNull();
    expect(creatorForAccount(creators, null)).toBeNull();
    expect(creatorForAccount(creators, "  ")).toBeNull();
  });
});

describe("a Practice lap", () => {
  it("in order, is the Library's order", () => {
    expect(practiceLap(samples, "in-order", seeded(1)).map((s) => s.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("at random, plays every Sample once", () => {
    const lap = practiceLap(samples, "random", seeded(7));
    expect([...lap.map((s) => s.id)].sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("at random, never starts a new lap on the Sample the last one ended on", () => {
    for (let seed = 0; seed < 200; seed++) {
      const random = seeded(seed);
      const first = practiceLap(samples, "random", random);
      const next = practiceLap(samples, "random", random, first.at(-1)!.id);
      expect(next[0].id).not.toBe(first.at(-1)!.id);
      expect(next).toHaveLength(samples.length);
    }
  });

  it("with one Sample, repeats it", () => {
    expect(practiceLap([{ id: "a" }], "random", seeded(3), "a").map((s) => s.id)).toEqual(["a"]);
  });
});

describe("a new Sample goes first", () => {
  it("takes a position below the lowest", () => {
    expect(firstPosition(null)).toBe(0);
    expect(firstPosition(0)).toBe(-1);
    expect(firstPosition(-4)).toBe(-5);
  });
});
