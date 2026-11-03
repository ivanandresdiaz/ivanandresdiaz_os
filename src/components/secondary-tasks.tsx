"use client";

import { useState } from "react";
import { SECONDARY_TASK_DURATION_MIN, type SecondaryTaskView } from "@/domain/secondary-tasks";
import { addSecondaryTask, deleteSecondaryTask } from "@/server/actions";
import { WORK_MIME, type WorkDrop } from "./time-grid";
import { ReminderMark } from "./reminder-bell";
import { AddIconButton, Hidden } from "./ui";
import { StopUpkeep, UpkeepMark, useDoneToggle } from "./upkeeps";

export function SecondaryTasks({
  date,
  today,
  tasks,
}: {
  date: string;
  today: string;
  /** `reminder`: a bell on one of its Slots from this day on. */
  tasks: (SecondaryTaskView & { reminder: { failed: boolean } | null })[];
}) {
  const [adding, setAdding] = useState(false);
  const [stopping, setStopping] = useState<string | null>(null);
  const { toggle, dialog } = useDoneToggle(today);

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Secondary Tasks</h2>
          <p className="text-xs text-muted">Useful, not strategic. Check them off here or drag them onto the calendar.</p>
        </div>
        {!adding && <AddIconButton label="Add Secondary Task" onClick={() => setAdding(true)} />}
      </div>

      <div className="flex flex-col gap-2 empty:hidden">
        {tasks.map((task) => (
          <div key={task.id} className="flex flex-col gap-1">
          <div
            draggable={!task.done}
            onDragStart={(event) => {
              const drop: WorkDrop = {
                kind: "secondary",
                id: task.id,
                durationMin: SECONDARY_TASK_DURATION_MIN,
              };
              event.dataTransfer.setData(WORK_MIME, JSON.stringify(drop));
              event.dataTransfer.effectAllowed = "copy";
            }}
            className={`group flex items-start gap-2 rounded-md border border-line px-2 py-1.5 text-sm ${
              task.done ? "opacity-60" : "cursor-grab active:cursor-grabbing"
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={task.done}
              onChange={() => toggle(task)}
              aria-label={`${task.title} done`}
            />
            <div className={`min-w-0 flex-1 ${task.done ? "line-through" : ""}`}>
              {task.title}
              {task.upkeep && <UpkeepMark upkeepId={task.upkeep.id} date={task.day} />}
              {task.reminder && (!task.done || task.reminder.failed) && <ReminderMark failed={task.reminder.failed} />}
              {task.carried > 0 && (
                <span
                  className="ml-1.5 rounded bg-amber-500/15 px-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
                  title={`Carried over for ${task.carried} day${task.carried === 1 ? "" : "s"}`}
                >
                  ×{task.carried}
                </span>
              )}
            </div>
            <button
              type="button"
              className="text-muted hover:text-red-600"
              onClick={() =>
                task.upkeep && !task.done ? setStopping(task.id) : deleteSecondaryTask({ id: task.id })
              }
              title={task.upkeep && !task.done ? "Stop this Upkeep" : "Delete Secondary Task"}
            >
              ×
            </button>
          </div>
          {stopping === task.id && task.upkeep && (
            <StopUpkeep id={task.upkeep.id} title={task.title} onCancel={() => setStopping(null)} />
          )}
          </div>
        ))}
      </div>

      {adding && (
        <form action={addSecondaryTask} className="flex gap-2">
          <Hidden date={date} />
          <input
            name="title"
            required
            autoFocus
            placeholder="What else do I want to get done?"
            className="input min-w-0 flex-1"
            onKeyDown={(event) => event.key === "Escape" && setAdding(false)}
          />
          <button className="btn">Add</button>
          <button type="button" className="text-sm text-muted hover:underline" onClick={() => setAdding(false)}>
            Done
          </button>
        </form>
      )}
      {dialog}
    </section>
  );
}
