import { describe, expect, it } from "vitest";
import { isDayWon, validateNewHighlight, type Highlight } from "./highlights";

const h = (done: boolean): Highlight => ({ title: "Ship SSO", why: "Unblocks login", done });

describe("Highlights", () => {
  it("allows up to 3, each with a why", () => {
    expect(validateNewHighlight([], { title: "Ship SSO", why: "Unblocks login" })).toBeNull();
    expect(validateNewHighlight([], { title: "Ship SSO", why: " " })).toBe("why-missing");
    expect(validateNewHighlight([], { title: "", why: "x" })).toBe("title-missing");
    expect(validateNewHighlight([h(false), h(false), h(false)], { title: "a", why: "b" })).toBe("too-many");
  });

  it("wins the day when every Highlight is done", () => {
    expect(isDayWon([])).toBe(false);
    expect(isDayWon([h(true), h(false)])).toBe(false);
    expect(isDayWon([h(true), h(true)])).toBe(true);
  });
});
