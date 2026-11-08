import { describe, expect, it } from "vitest";
import {
  CLIP_GIVE_UP_MS,
  computerLabel,
  elapsedLabel,
  inFlightLabel,
  downloadPlace,
  downloadsOnSave,
  parseClipLink,
  settleClip,
  youtubeIdOf,
  type ClipResult,
} from "./clips";

describe("A pasted link", () => {
  it("saves a reel under one link, however it was copied", () => {
    const reel = { source: "instagram", url: "https://www.instagram.com/reel/Cop84x6u7CP/" };
    expect(parseClipLink("https://www.instagram.com/reel/Cop84x6u7CP/?igsh=abc123")).toEqual(reel);
    expect(parseClipLink("https://instagram.com/reels/Cop84x6u7CP")).toEqual(reel);
    expect(parseClipLink("www.instagram.com/someone/reel/Cop84x6u7CP/")).toEqual(reel);
    expect(parseClipLink("  https://m.instagram.com/reel/Cop84x6u7CP/  ")).toEqual(reel);
  });

  it("takes only reels from Instagram, for now", () => {
    expect(parseClipLink("https://www.instagram.com/p/Cop84x6u7CP/")).toEqual({ problem: "only-reels" });
    expect(parseClipLink("https://www.instagram.com/someone/")).toEqual({ problem: "only-reels" });
  });

  it("saves a YouTube video under its watch link", () => {
    const video = { source: "youtube", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw", youtubeId: "jNQXAC9IVRw" };
    expect(parseClipLink("https://www.youtube.com/watch?v=jNQXAC9IVRw&t=42s&si=x")).toEqual(video);
    expect(parseClipLink("https://youtu.be/jNQXAC9IVRw?si=x")).toEqual(video);
    expect(parseClipLink("https://youtube.com/shorts/jNQXAC9IVRw")).toEqual(video);
    expect(parseClipLink("https://m.youtube.com/watch?v=jNQXAC9IVRw")).toEqual(video);
    expect(youtubeIdOf("https://www.youtube.com/watch?v=jNQXAC9IVRw")).toBe("jNQXAC9IVRw");
  });

  it("says why it can't take the rest", () => {
    expect(parseClipLink("hello")).toEqual({ problem: "not-a-link" });
    expect(parseClipLink("")).toEqual({ problem: "not-a-link" });
    expect(parseClipLink("javascript:alert(1)")).toEqual({ problem: "not-a-link" });
    expect(parseClipLink("https://www.tiktok.com/@a/video/1")).toEqual({ problem: "unsupported" });
    expect(parseClipLink("https://www.youtube.com/@channel")).toEqual({ problem: "unsupported" });
  });
});

describe("What a download's result means", () => {
  const started = new Date("2026-11-07T10:00:00Z");
  const soon = new Date("2026-11-07T10:05:00Z");
  const fail = (extra: Partial<Extract<ClipResult, { ok: false }>>): ClipResult => ({
    ok: false,
    final: false,
    reason: "error",
    message: "boom",
    attempt: 0,
    ...extra,
  });

  it("keeps waiting while nothing came back", () => {
    expect(settleClip(null, started, soon)).toEqual({ status: "downloading", attempt: null });
  });

  it("gives up when nothing came back for hours", () => {
    const late = new Date(started.getTime() + CLIP_GIVE_UP_MS + 1);
    expect(settleClip(null, started, late)).toMatchObject({ status: "failed" });
  });

  it("is ready when the file arrived", () => {
    const result: ClipResult = {
      ok: true,
      title: "Me",
      durationS: 19,
      contentType: "video/mp4",
      sizeBytes: 9,
      attempt: 1,
    };
    expect(settleClip(result, started, soon)).toEqual({
      status: "ready",
      title: "Me",
      durationS: 19,
      contentType: "video/mp4",
    });
  });

  it("keeps waiting while Cloud Run still has a retry", () => {
    expect(settleClip(fail({ attempt: 0 }), started, soon)).toEqual({ status: "downloading", attempt: 1 });
    expect(settleClip(fail({ attempt: 1 }), started, soon)).toEqual({ status: "downloading", attempt: 2 });
    expect(settleClip(fail({ attempt: 2 }), started, soon)).toMatchObject({
      status: "failed",
      error: "Couldn't download.",
    });
  });

  it("believes Instagram wants a login only after the retries", () => {
    expect(settleClip(fail({ reason: "login", attempt: 1 }), started, soon)).toEqual({
      status: "downloading",
      attempt: 2,
    });
    expect(settleClip(fail({ reason: "login", attempt: 2 }), started, soon)).toMatchObject({
      status: "failed",
      error: "Instagram wants a login. Retry later, or refresh its session.",
    });
  });

  it("says what Instagram actually said", () => {
    expect(settleClip(fail({ reason: "rate_limit", attempt: 2 }), started, soon)).toMatchObject({
      error: "Instagram is limiting downloads right now. Retry later.",
    });
    expect(settleClip(fail({ reason: "empty", attempt: 2 }), started, soon)).toMatchObject({
      error: "Instagram didn't hand over the reel. It may be private or gone.",
    });
  });

  it("gives up at once on a post that is gone", () => {
    expect(settleClip(fail({ final: true, reason: "unavailable" }), started, soon)).toMatchObject({
      status: "failed",
      error: "The post is gone or private.",
    });
  });

  it("leaves a video over 30 minutes as a link, not a failure", () => {
    expect(
      settleClip(fail({ final: true, reason: "too_long", durationS: 2700, title: "Talk" }), started, soon),
    ).toEqual({
      status: "link",
      error: "Longer than 30 minutes, so it stays a link.",
      title: "Talk",
      durationS: 2700,
    });
  });
});

describe("Where a Clip downloads", () => {
  it("downloads a reel on Cloud Run as soon as it is saved", () => {
    expect(downloadsOnSave("instagram")).toBe(true);
    expect(downloadPlace("instagram")).toBe("cloud");
  });

  it("waits for Ivan's computer for a YouTube video, and only when asked", () => {
    expect(downloadsOnSave("youtube")).toBe(false);
    expect(downloadPlace("youtube")).toBe("computer");
  });
});

describe("What a Clip in flight says", () => {
  const now = new Date("2026-11-07T21:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const time = (at: Date) => at.toISOString().slice(11, 16);

  it("counts the time it has been going", () => {
    expect(elapsedLabel(20_000)).toBe("20 s");
    expect(elapsedLabel(4 * 60_000 + 5_000)).toBe("4 min");
    expect(elapsedLabel(65 * 60_000)).toBe("1 h 5 min");
  });

  it("names where it runs and which try it is", () => {
    expect(inFlightLabel({ source: "instagram", startedAt: ago(20_000), attempt: 0 }, now)).toBe(
      "Downloading in the cloud · 20 s",
    );
    expect(inFlightLabel({ source: "youtube", startedAt: ago(60_000), attempt: 0 }, now)).toBe(
      "Downloading on your computer · 1 min",
    );
    expect(inFlightLabel({ source: "instagram", startedAt: ago(90_000), attempt: 1 }, now)).toBe(
      "Retrying in the cloud (2 of 3) · 1 min",
    );
  });

  it("says whether the computer is there to download it", () => {
    expect(computerLabel(ago(10_000), now, time)).toBe("Your computer checked just now.");
    expect(computerLabel(ago(2 * 60_000), now, time)).toBe("Your computer checked 2 min ago.");
    expect(computerLabel(ago(2 * 3600_000), now, time)).toBe(
      "Your computer hasn't checked in since 19:00. It downloads when it's back on.",
    );
    expect(computerLabel(null, now, time)).toBe("Your computer hasn't checked in yet.");
  });
});
