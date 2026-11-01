import { describe, expect, it } from "vitest";
import { dictationExtension, dictationKey, diffWords, insertDictation, isDictationKey } from "./english";

describe("Dictation", () => {
  it("goes where the cursor was, with spaces around it", () => {
    expect(insertDictation("I want to grow.", "really", { start: 7, end: 7 })).toEqual({
      text: "I want really to grow.",
      caret: 13,
    });
  });

  it("replaces a selection and nothing else", () => {
    expect(insertDictation("I want to grow.", "need", { start: 2, end: 6 }).text).toBe("I need to grow.");
  });

  it("goes at the end when the field had no cursor", () => {
    expect(insertDictation("First idea.", "Second idea.", null)).toEqual({
      text: "First idea. Second idea.",
      caret: 24,
    });
    expect(insertDictation("", "  Hello there ", null).text).toBe("Hello there");
    expect(insertDictation("Line one\n", "line two", null).text).toBe("Line one\nline two");
  });

  it("changes nothing when nothing was said", () => {
    expect(insertDictation("Keep me", "   ", null).text).toBe("Keep me");
  });

  it("only touches temporary recordings", () => {
    const key = dictationKey("0b6b7c1e-6a43-4c8e-9a52-1f1d3c2e4b5a", "m4a");
    expect(isDictationKey(key)).toBe(true);
    expect(isDictationKey("principles/abc/ref.mp4")).toBe(false);
    expect(isDictationKey("dictation/../principles/x.m4a")).toBe(false);
  });

  it("knows the recording formats of iPhone and desktop browsers", () => {
    expect(dictationExtension("audio/mp4")).toBe("m4a");
    expect(dictationExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(dictationExtension("video/mp4")).toBeNull();
  });
});

describe("English Coach changes", () => {
  it("marks the words removed and added", () => {
    expect(diffWords("I am agree with you", "I agree with you")).toEqual([
      { kind: "same", text: "I " },
      { kind: "removed", text: "am " },
      { kind: "same", text: "agree with you" },
    ]);
    expect(diffWords("He go home", "He goes home")).toEqual([
      { kind: "same", text: "He " },
      { kind: "removed", text: "go" },
      { kind: "added", text: "goes" },
      { kind: "same", text: " home" },
    ]);
  });

  it("rebuilds both texts exactly", () => {
    const mine = "This season is about\n\nprepare the artillery";
    const polished = "This Season is about\n\npreparing the artillery.";
    const parts = diffWords(mine, polished)!;
    const join = (kind: "removed" | "added") =>
      parts
        .filter((p) => p.kind !== kind)
        .map((p) => p.text)
        .join("");
    expect(join("added")).toBe(mine);
    expect(join("removed")).toBe(polished);
  });
});
