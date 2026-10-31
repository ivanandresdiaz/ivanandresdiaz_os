import { describe, expect, it } from "vitest";
import {
  MAX_REFERENCE_BYTES,
  moveItem,
  referenceKey,
  referenceKindOf,
  referencePrefix,
  validateReferenceFile,
} from "./references";

const PRINCIPLE = "6f1c2d1e-0000-4000-8000-000000000001";

describe("References", () => {
  it("accepts images and videos up to 200 MB", () => {
    expect(validateReferenceFile({ contentType: "video/mp4", size: 50_000_000 })).toBeNull();
    expect(validateReferenceFile({ contentType: "image/webp", size: 1 })).toBeNull();
    expect(validateReferenceFile({ contentType: "video/quicktime", size: MAX_REFERENCE_BYTES })).toBeNull();
    expect(validateReferenceFile({ contentType: "video/mp4", size: MAX_REFERENCE_BYTES + 1 })).toBe("too-large");
    expect(validateReferenceFile({ contentType: "video/mp4", size: 0 })).toBe("empty");
    expect(validateReferenceFile({ contentType: "application/pdf", size: 10 })).toBe("unsupported-type");
    expect(validateReferenceFile({ contentType: "", size: 10 })).toBe("unsupported-type");
  });

  it("knows whether a file is an image or a video", () => {
    expect(referenceKindOf("image/gif")).toBe("image");
    expect(referenceKindOf("video/webm")).toBe("video");
    expect(referenceKindOf("text/plain")).toBeNull();
  });

  it("keeps every file of a Principle under its prefix", () => {
    const key = referenceKey(PRINCIPLE, "abc", "video/quicktime");
    expect(key).toBe(`principles/${PRINCIPLE}/references/abc.mov`);
    expect(key.startsWith(referencePrefix(PRINCIPLE))).toBe(true);
  });

  it("reorders by moving one item", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});
