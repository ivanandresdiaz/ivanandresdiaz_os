import { describe, expect, it } from "vitest";
import { followSlot, isDayWon, validateNewHighlight, type Highlight } from "./highlights";

const h = (done: boolean): Highlight => ({ title: "Ship SSO", why: "", done });
const TODAY = "2026-11-05";

describe("Highlights", () => {
  it("takes up to 3 per day, on scheduled work, today or later", () => {
    const base = { count: 0, date: TODAY, today: TODAY, scheduled: true };
    expect(validateNewHighlight(base)).toBeNull();
    expect(validateNewHighlight({ ...base, date: "2026-11-09" })).toBeNull();
    expect(validateNewHighlight({ ...base, count: 2 })).toBeNull();
    expect(validateNewHighlight({ ...base, count: 3 })).toBe("too-many");
    expect(validateNewHighlight({ ...base, date: "2026-11-04" })).toBe("past-day");
    expect(validateNewHighlight({ ...base, scheduled: false })).toBe("not-scheduled");
  });

  it("wins the day when every Highlight is done", () => {
    expect(isDayWon([])).toBe(false);
    expect(isDayWon([h(true), h(false)])).toBe(false);
    expect(isDayWon([h(true), h(true)])).toBe(true);
  });
});

describe("A Highlight follows its Slots", () => {
  const moved = { slotsLeft: 0, to: "2026-11-06", today: TODAY, toCount: 0, toHasIt: false };

  it("stays while the work keeps another Slot that day", () => {
    expect(followSlot({ ...moved, slotsLeft: 1 })).toBe("stays");
    expect(followSlot({ ...moved, slotsLeft: 1, to: null })).toBe("stays");
  });

  it("moves with the last Slot to a day with room", () => {
    expect(followSlot(moved)).toBe("moves");
    expect(followSlot({ ...moved, toCount: 2 })).toBe("moves");
  });

  it("goes away when the last Slot is removed", () => {
    expect(followSlot({ ...moved, to: null })).toBe("drops");
  });

  it("joins the Highlight the other day already has for that work", () => {
    expect(followSlot({ ...moved, toHasIt: true, toCount: 3 })).toBe("joins");
  });

  it("drops off on a full day or a past one", () => {
    expect(followSlot({ ...moved, toCount: 3 })).toBe("drops-full");
    expect(followSlot({ ...moved, to: "2026-11-04" })).toBe("drops-past");
  });
});
