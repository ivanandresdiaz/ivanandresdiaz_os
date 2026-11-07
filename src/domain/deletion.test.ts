import { describe, expect, it } from "vitest";
import { describeDeletion } from "./deletion";

describe("What a delete takes with it", () => {
  it("names nothing when nothing goes with it", () => {
    expect(describeDeletion({})).toBeNull();
    expect(describeDeletion({ tasks: 0, steps: 0, slots: 0 })).toBeNull();
  });

  it("lists every count above zero, in order", () => {
    expect(describeDeletion({ slots: 3, tasks: 4, steps: 9, links: 2 })).toBe(
      "Its 4 Tasks, 9 Steps, 2 Links and 3 Slots on the calendar go too.",
    );
    expect(describeDeletion({ tasks: 2, steps: 0, slots: 1 })).toBe("Its 2 Tasks and 1 Slot on the calendar go too.");
  });

  it("speaks of a single thing in the singular", () => {
    expect(describeDeletion({ steps: 1 })).toBe("Its 1 Step goes too.");
    expect(describeDeletion({ references: 2 })).toBe("Its 2 References go too.");
  });

  it("tells that Campaigns stay when their Season Goal goes", () => {
    expect(describeDeletion({ campaigns: 1 })).toBe("1 Campaign stays, without this Season Goal.");
    expect(describeDeletion({ campaigns: 2 })).toBe("2 Campaigns stay, without this Season Goal.");
  });
});
