import { describe, expect, it } from "vitest";
import { isReminderLead, leadLabel, reminderEvent, reminderPlan, slotStarted } from "./reminders";

describe("Reminders", () => {
  it("only takes the offered leads", () => {
    expect(isReminderLead(10)).toBe(true);
    expect(isReminderLead(0)).toBe(true);
    expect(isReminderLead(7)).toBe(false);
    expect(isReminderLead(120)).toBe(false);
  });

  it("names the lead", () => {
    expect(leadLabel(0)).toBe("At start");
    expect(leadLabel(10)).toBe("10 min before");
  });

  it("knows when a Slot has started", () => {
    const now = { date: "2026-11-03", minute: 9 * 60 + 55 };
    expect(slotStarted({ date: "2026-11-03", startMin: 10 * 60 }, now)).toBe(false);
    expect(slotStarted({ date: "2026-11-03", startMin: 9 * 60 + 55 }, now)).toBe(true);
    expect(slotStarted({ date: "2026-11-02", startMin: 23 * 60 }, now)).toBe(true);
    expect(slotStarted({ date: "2026-11-04", startMin: 0 }, now)).toBe(false);
  });

  it("keeps an event in Google only for a Slot with its bell and open work", () => {
    expect(reminderPlan({ leadMin: 10, done: false, eventId: null })).toBe("write");
    expect(reminderPlan({ leadMin: 10, done: false, eventId: "e1" })).toBe("write");
    expect(reminderPlan({ leadMin: 10, done: true, eventId: "e1" })).toBe("remove");
    expect(reminderPlan({ leadMin: null, done: false, eventId: "e1" })).toBe("remove");
    expect(reminderPlan({ leadMin: null, done: false, eventId: null })).toBe("nothing");
    expect(reminderPlan({ leadMin: 10, done: true, eventId: null })).toBe("nothing");
  });

  it("writes the event in Ivan's wall clock, with the lead as a popup", () => {
    const event = reminderEvent({
      title: "Meeting with my boss",
      date: "2026-11-03",
      startMin: 10 * 60,
      endMin: 11 * 60 + 30,
      leadMin: 10,
      timeZone: "America/Bogota",
      dayUrl: "https://example.test/os/day/2026-11-03",
    });
    expect(event.summary).toBe("Meeting with my boss");
    expect(event.start).toEqual({ dateTime: "2026-11-03T10:00:00", timeZone: "America/Bogota" });
    expect(event.end).toEqual({ dateTime: "2026-11-03T11:30:00", timeZone: "America/Bogota" });
    expect(event.reminders).toEqual({ useDefault: false, overrides: [{ method: "popup", minutes: 10 }] });
    expect(event.description).toContain("/os/day/2026-11-03");
  });

  it("ends a Slot that runs to midnight on the next day", () => {
    const event = reminderEvent({
      title: "Late",
      date: "2026-12-31",
      startMin: 23 * 60,
      endMin: 1440,
      leadMin: 0,
      timeZone: "America/Bogota",
      dayUrl: "https://example.test/os/day/2026-12-31",
    });
    expect(event.end.dateTime).toBe("2027-01-01T00:00:00");
  });
});
