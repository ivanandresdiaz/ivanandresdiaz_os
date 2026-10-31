"use client";

import { SECONDARY_TASK_DURATION_MIN, type SecondaryTaskView } from "@/domain/secondary-tasks";
import { addSecondaryTask, deleteSecondaryTask, toggleWorkDone } from "@/server/actions";
import { WORK_MIME, type WorkDrop } from "./time-grid";
import { Hidden } from "./ui";

export function SecondaryTasks({ date, tasks }: { date: string; tasks: SecondaryTaskView[] }) {
  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">Secondary Tasks</h2>
        <p className="text-xs text-muted">Useful, not strategic. Check them off here or drag them onto the calendar.</p>
      </div>

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div
            key={task.id}
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
              onChange={() => toggleWorkDone({ kind: "secondary", id: task.id })}
              aria-label={`${task.title} done`}
            />
            <div className={`min-w-0 flex-1 ${task.done ? "line-through" : ""}`}>
              {task.title}
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
              onClick={() => deleteSecondaryTask({ id: task.id })}
              title="Delete Secondary Task"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <form action={addSecondaryTask} className="flex gap-2 border-t border-line pt-3">
        <Hidden date={date} />
        <input name="title" required placeholder="Add a Secondary Task" className="input min-w-0 flex-1" />
        <button className="btn">Add</button>
      </form>
    </section>
  );
}
