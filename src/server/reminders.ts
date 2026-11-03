import "server-only";
import { and, eq, inArray, isNotNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { localMoment } from "@/domain/dates";
import { DEFAULT_REMINDER_LEAD, reminderEvent, reminderPlan, slotStarted } from "@/domain/reminders";
import { APP_TIMEZONE } from "@/lib/today";
import { appOrigin, removeEvent, writeEvent } from "./google-calendar";

/**
 * Brings Google Calendar in line with Ivan OS for some Slots. Never throws:
 * the Slot is already saved, and a failure is kept on it so its bell shows it.
 */
async function syncWhere(where: SQL | undefined) {
  if (!where) return;
  const rows = await db
    .select({
      id: s.slots.id,
      date: s.slots.date,
      startMin: s.slots.startMin,
      endMin: s.slots.endMin,
      leadMin: s.slots.reminderLeadMin,
      eventId: s.slots.reminderEventId,
      taskTitle: s.tasks.title,
      taskDoneAt: s.tasks.doneAt,
      moveTitle: s.moves.title,
      moveDoneAt: s.moves.doneAt,
      secondaryTitle: s.secondaryTasks.title,
      secondaryDoneAt: s.secondaryTasks.doneAt,
    })
    .from(s.slots)
    .leftJoin(s.tasks, eq(s.tasks.id, s.slots.taskId))
    .leftJoin(s.moves, eq(s.moves.id, s.slots.moveId))
    .leftJoin(s.secondaryTasks, eq(s.secondaryTasks.id, s.slots.secondaryTaskId))
    // Only Slots that have, or had, a bell: the rest never touch Google.
    .where(
      and(
        where,
        or(isNotNull(s.slots.reminderLeadMin), isNotNull(s.slots.reminderEventId), eq(s.slots.reminderFailed, true)),
      ),
    );
  if (rows.length === 0) return;

  const origin = (await appOrigin()) ?? "";
  await Promise.all(
    rows.map(async (row) => {
      const title = row.taskTitle ?? row.moveTitle ?? row.secondaryTitle ?? "";
      const done = (row.taskDoneAt ?? row.moveDoneAt ?? row.secondaryDoneAt) !== null;
      const plan = reminderPlan({ leadMin: row.leadMin, done, eventId: row.eventId });
      try {
        if (plan === "write") {
          const eventId = await writeEvent(
            row.id,
            reminderEvent({
              title,
              date: row.date,
              startMin: row.startMin,
              endMin: row.endMin,
              leadMin: row.leadMin!,
              timeZone: APP_TIMEZONE,
              dayUrl: `${origin}/os/day/${row.date}`,
            }),
          );
          // An event written under another id before (rare): only one may remind.
          if (row.eventId && row.eventId !== eventId) await removeEvent(row.eventId);
          await db.update(s.slots).set({ reminderEventId: eventId, reminderFailed: false }).where(eq(s.slots.id, row.id));
        } else if (plan === "remove") {
          await removeEvent(row.eventId!);
          await db.update(s.slots).set({ reminderEventId: null, reminderFailed: false }).where(eq(s.slots.id, row.id));
        } else {
          await db.update(s.slots).set({ reminderFailed: false }).where(eq(s.slots.id, row.id));
        }
      } catch (error) {
        console.error("Reminder sync failed", row.id, error);
        await db.update(s.slots).set({ reminderFailed: true }).where(eq(s.slots.id, row.id));
      }
    }),
  );
}

/** Events whose Slot was deleted (queued by a trigger, cascades included). */
async function flushCleanups() {
  const queued = await db.select().from(s.calendarCleanups).limit(50);
  for (const { eventId } of queued) {
    try {
      await removeEvent(eventId);
      await db.delete(s.calendarCleanups).where(eq(s.calendarCleanups.eventId, eventId));
    } catch (error) {
      // Kept for the next time Google answers.
      console.error("Calendar cleanup failed", error);
      return;
    }
  }
}

/** After Slots changed: their events follow them. */
export async function syncSlots(ids: string[]) {
  await syncWhere(ids.length ? inArray(s.slots.id, ids) : undefined);
  await flushCleanups();
}

/** After work changed (done, reopened, renamed): every Slot of it follows. */
export async function syncWork(kind: "task" | "move" | "secondary", ids: string[]) {
  if (ids.length === 0) return flushCleanups();
  const column = kind === "task" ? s.slots.taskId : kind === "move" ? s.slots.moveId : s.slots.secondaryTaskId;
  await syncWhere(inArray(column, ids));
  await flushCleanups();
}

/** After Slots were deleted, directly or by cascade: only their events go. */
export const syncDeletions = flushCleanups;

/** Tries again every Slot whose last change did not reach Google (e.g. after reconnecting). */
export async function retryFailedReminders() {
  await syncWhere(eq(s.slots.reminderFailed, true));
  await flushCleanups();
}

/** After connecting Google Calendar from a bell: that bell turns on, 10 min before. */
export async function turnOnPendingReminder(slotId: string) {
  const [slot] = await db.select().from(s.slots).where(eq(s.slots.id, slotId));
  if (!slot || slot.reminderLeadMin !== null) return;
  if (slotStarted(slot, localMoment(new Date(), APP_TIMEZONE))) return;
  await db.update(s.slots).set({ reminderLeadMin: DEFAULT_REMINDER_LEAD }).where(eq(s.slots.id, slotId));
  await syncSlots([slotId]);
}
