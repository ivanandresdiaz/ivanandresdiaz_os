import { addDays, formatMinutes, type IsoDate, type Minutes } from "./dates";

/** How long before the start of its Slot a Reminder can go off; 0 is at the start. */
export const REMINDER_LEADS = [0, 5, 10, 15, 30, 60] as const;
export type ReminderLead = (typeof REMINDER_LEADS)[number];

/** Turning the bell on: 10 minutes before. */
export const DEFAULT_REMINDER_LEAD: ReminderLead = 10;

export function isReminderLead(value: number): value is ReminderLead {
  return (REMINDER_LEADS as readonly number[]).includes(value);
}

export function leadLabel(lead: number): string {
  return lead === 0 ? "At start" : `${lead} min before`;
}

/** A Slot that has already started offers no bell: there is nothing left to remind. */
export function slotStarted(
  slot: { date: IsoDate; startMin: Minutes },
  now: { date: IsoDate; minute: Minutes },
): boolean {
  return slot.date < now.date || (slot.date === now.date && slot.startMin <= now.minute);
}

/** What Google Calendar must hold for one Slot. */
export type ReminderPlan = "write" | "remove" | "nothing";

/**
 * A Slot with its bell whose work is still open has an event in Google; any
 * other Slot has none. Ivan OS is the only source: whatever Google holds is
 * written over.
 */
export function reminderPlan(slot: { leadMin: number | null; done: boolean; eventId: string | null }): ReminderPlan {
  if (slot.leadMin !== null && !slot.done) return "write";
  return slot.eventId ? "remove" : "nothing";
}

/** "2026-11-03T10:00:00": a wall-clock time Google reads in the event's time zone. 24:00 is the next day. */
function wallClock(date: IsoDate, minute: Minutes): string {
  const day = minute >= 1440 ? addDays(date, 1) : date;
  return `${day}T${formatMinutes(minute % 1440)}:00`;
}

/** The Google Calendar event that carries a Slot's Reminder. */
export function reminderEvent(input: {
  title: string;
  date: IsoDate;
  startMin: Minutes;
  endMin: Minutes;
  leadMin: number;
  timeZone: string;
  dayUrl: string;
}) {
  return {
    summary: input.title,
    description: `Open it in Ivan OS: ${input.dayUrl}`,
    start: { dateTime: wallClock(input.date, input.startMin), timeZone: input.timeZone },
    end: { dateTime: wallClock(input.date, input.endMin), timeZone: input.timeZone },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: input.leadMin }] },
    // Deleted by hand in Google: writing it again brings it back.
    status: "confirmed",
  };
}
