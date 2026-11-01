import { describe, expect, it } from "vitest";
import {
  formatClock,
  MAX_REFERENCE_BYTES,
  moveItem,
  referenceContentType,
  referenceKey,
  referenceKindOf,
  referencePrefix,
  skipTo,
  titleFromFileName,
  validateReferenceFile,
} from "./references";

const PRINCIPLE = "6f1c2d1e-0000-4000-8000-000000000001";

describe("References", () => {
  it("accepts images, videos and audios up to 200 MB", () => {
    expect(validateReferenceFile({ contentType: "video/mp4", size: 50_000_000 })).toBeNull();
    expect(validateReferenceFile({ contentType: "image/webp", size: 1 })).toBeNull();
    expect(validateReferenceFile({ contentType: "audio/mpeg", size: 12_000_000 })).toBeNull();
    expect(validateReferenceFile({ contentType: "video/quicktime", size: MAX_REFERENCE_BYTES })).toBeNull();
    expect(validateReferenceFile({ contentType: "audio/wav", size: MAX_REFERENCE_BYTES + 1 })).toBe("too-large");
    expect(validateReferenceFile({ contentType: "video/mp4", size: 0 })).toBe("empty");
    expect(validateReferenceFile({ contentType: "application/pdf", size: 10 })).toBe("unsupported-type");
    expect(validateReferenceFile({ contentType: "", size: 10 })).toBe("unsupported-type");
  });

  it("knows whether a file is an image, a video or an audio", () => {
    expect(referenceKindOf("image/gif")).toBe("image");
    expect(referenceKindOf("video/webm")).toBe("video");
    expect(referenceKindOf("audio/x-m4a")).toBe("audio");
    expect(referenceKindOf("audio/ogg")).toBe("audio");
    expect(referenceKindOf("text/plain")).toBeNull();
  });

  it("falls back to the extension when the browser names the type oddly or not at all", () => {
    expect(referenceContentType({ type: "audio/mpeg", name: "episode.mp3" })).toBe("audio/mpeg");
    expect(referenceContentType({ type: "", name: "Episode 12.MP3" })).toBe("audio/mpeg");
    expect(referenceContentType({ type: "audio/x-opus+ogg", name: "clip.opus" })).toBe("audio/ogg");
    expect(referenceContentType({ type: "audio/x-vorbis+ogg", name: "clip.ogg" })).toBe("audio/ogg");
    expect(referenceContentType({ type: "application/pdf", name: "notes.pdf" })).toBe("application/pdf");
  });

  it("titles a Reference after its file name", () => {
    expect(titleFromFileName("Huberman - Dopamine (clip).mp3")).toBe("Huberman - Dopamine (clip)");
    expect(titleFromFileName("archive.tar.gz")).toBe("archive.tar");
    expect(titleFromFileName("no-extension")).toBe("no-extension");
    expect(titleFromFileName(".hidden")).toBe(".hidden");
    expect(titleFromFileName(`${"a".repeat(300)}.mp3`)).toHaveLength(200);
  });

  it("formats playback time", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(192.7)).toBe("3:12");
    expect(formatClock(588)).toBe("9:48");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(Number.NaN)).toBe("0:00");
  });

  it("keeps skips inside the audio", () => {
    expect(skipTo(30, 15, 600)).toBe(45);
    expect(skipTo(10, -15, 600)).toBe(0);
    expect(skipTo(595, 15, 600)).toBe(600);
    expect(skipTo(20, 15, Number.NaN)).toBe(35);
  });

  it("keeps every file of a Principle under its prefix", () => {
    const key = referenceKey(PRINCIPLE, "abc", "video/quicktime");
    expect(key).toBe(`principles/${PRINCIPLE}/references/abc.mov`);
    expect(key.startsWith(referencePrefix(PRINCIPLE))).toBe(true);
    expect(referenceKey(PRINCIPLE, "abc", "audio/x-m4a")).toBe(`principles/${PRINCIPLE}/references/abc.m4a`);
  });

  it("reorders by moving one item", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});
