import { describe, expect, it } from "vitest";
import { linkLabel, normalizeLinkUrl } from "./links";

describe("Links", () => {
  it("adds https to an address pasted without it", () => {
    expect(normalizeLinkUrl("aihero.dev/skills")).toBe("https://aihero.dev/skills");
    expect(normalizeLinkUrl("  https://remotion.dev/docs  ")).toBe("https://remotion.dev/docs");
    expect(normalizeLinkUrl("http://localhost:3200/os")).toBe("http://localhost:3200/os");
  });

  it("only takes web pages", () => {
    expect(normalizeLinkUrl("")).toBeNull();
    expect(normalizeLinkUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeLinkUrl("mailto:someone@example.com")).toBeNull();
    expect(normalizeLinkUrl("ftp://example.com/file")).toBeNull();
    expect(normalizeLinkUrl("not a link")).toBeNull();
    expect(normalizeLinkUrl("remotion")).toBeNull();
  });

  it("shows the title, or else the address without the noise", () => {
    expect(linkLabel({ url: "https://aihero.dev/skills", title: "Matt's skills" })).toBe("Matt's skills");
    expect(linkLabel({ url: "https://www.aihero.dev/skills/", title: "" })).toBe("aihero.dev/skills");
    expect(linkLabel({ url: "https://remotion.dev/", title: "  " })).toBe("remotion.dev");
    expect(linkLabel({ url: "https://youtube.com/watch?v=abc", title: "" })).toBe("youtube.com/watch?v=abc");
  });
});
