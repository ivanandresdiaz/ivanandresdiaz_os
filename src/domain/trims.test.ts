import { describe, expect, it } from "vitest";
import {
  clock,
  normalizeTrim,
  parseClock,
  removedLabel,
  settleTrim,
  TRIM_GIVE_UP_MS,
  trimProblem,
  trimmedContentType,
} from "./trims";

describe("clock and parseClock", () => {
  it("writes minutes and seconds, tenths only when there are any, hours only when needed", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(47)).toBe("0:47");
    expect(clock(47.34)).toBe("0:47.3");
    expect(clock(62)).toBe("1:02");
    expect(clock(3725)).toBe("1:02:05");
  });

  it("reads what it writes, and plain seconds", () => {
    for (const s of [0, 47, 47.3, 62, 3725]) expect(parseClock(clock(s))).toBeCloseTo(s);
    expect(parseClock("47")).toBe(47);
    expect(parseClock(" 0:47.5 ")).toBe(47.5);
  });

  it("refuses what isn't a time", () => {
    for (const text of ["", "abc", "1:75", "1.5:20", "1:2:3:4", "-3", "0:"]) expect(parseClock(text)).toBeNull();
  });
});

describe("normalizeTrim", () => {
  it("rounds to a tenth and treats a mark at the very edge as no cut", () => {
    expect(normalizeTrim({ startS: 0.02, endS: 59.98 }, 60)).toEqual({ startS: null, endS: null });
    expect(normalizeTrim({ startS: 3.04, endS: 47.26 }, 60)).toEqual({ startS: 3, endS: 47.3 });
  });

  it("keeps an end it can't compare when the duration is unknown", () => {
    expect(normalizeTrim({ startS: null, endS: 47 }, null)).toEqual({ startS: null, endS: 47 });
  });
});

describe("trimProblem", () => {
  it("needs something cut", () => {
    expect(trimProblem({ startS: null, endS: null }, 60)).toBe("nothing-removed");
  });

  it("keeps at least a second", () => {
    expect(trimProblem({ startS: 10, endS: 10.5 }, 60)).toBe("too-short");
    expect(trimProblem({ startS: 59.5, endS: null }, 60)).toBe("too-short");
    expect(trimProblem({ startS: 10, endS: 11 }, 60)).toBeNull();
  });

  it("stays inside the file", () => {
    expect(trimProblem({ startS: 60, endS: null }, 60)).toBe("out-of-range");
    expect(trimProblem({ startS: null, endS: 61 }, 60)).toBe("out-of-range");
    expect(trimProblem({ startS: -1, endS: null }, null)).toBe("out-of-range");
    expect(trimProblem({ startS: Number.NaN, endS: null }, null)).toBe("out-of-range");
  });

  it("checks what it can without the duration", () => {
    expect(trimProblem({ startS: 3, endS: null }, null)).toBeNull();
    expect(trimProblem({ startS: 5, endS: 5.5 }, null)).toBe("too-short");
  });
});

describe("removedLabel", () => {
  it("names each part that goes", () => {
    expect(removedLabel({ startS: 3, endS: 47 }, 58)).toBe("This removes 0:00–0:03 and 0:47–0:58 for good.");
    expect(removedLabel({ startS: null, endS: 47 }, 58)).toBe("This removes 0:47–0:58 for good.");
    expect(removedLabel({ startS: null, endS: 47 }, null)).toBe("This removes from 0:47 on for good.");
  });
});

describe("trimmedContentType", () => {
  it("stores a video as mp4 and an audio as m4a", () => {
    expect(trimmedContentType("video")).toBe("video/mp4");
    expect(trimmedContentType("audio")).toBe("audio/mp4");
  });
});

describe("settleTrim", () => {
  const startedAt = new Date("2026-11-08T12:00:00Z");
  const soon = new Date(startedAt.getTime() + 60_000);

  it("waits while there is no result, and gives up after hours", () => {
    expect(settleTrim(null, startedAt, soon)).toEqual({ status: "trimming", attempt: null });
    expect(settleTrim(null, startedAt, new Date(startedAt.getTime() + TRIM_GIVE_UP_MS + 1)).status).toBe("failed");
  });

  it("is done with a file", () => {
    const result = { ok: true as const, contentType: "video/mp4", sizeBytes: 10, durationS: 47, attempt: 0 };
    expect(settleTrim(result, startedAt, soon)).toEqual({ status: "done", contentType: "video/mp4" });
  });

  it("waits for Cloud Run's retries before failing", () => {
    const failure = { ok: false as const, final: false, reason: "error" as const, message: "x", attempt: 0 };
    expect(settleTrim(failure, startedAt, soon)).toEqual({ status: "trimming", attempt: 1 });
    expect(settleTrim({ ...failure, attempt: 2 }, startedAt, soon)).toEqual({
      status: "failed",
      error: "Couldn't trim.",
    });
  });

  it("fails at once when no retry would help", () => {
    const failure = { ok: false as const, final: true, reason: "nothing_left" as const, message: "x", attempt: 0 };
    expect(settleTrim(failure, startedAt, soon)).toEqual({
      status: "failed",
      error: "Nothing was left after the cut.",
    });
  });
});
