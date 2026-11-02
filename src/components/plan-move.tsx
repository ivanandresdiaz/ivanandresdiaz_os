import {
  createStep,
  createTask,
  deleteMove,
  deleteStep,
  deleteTask,
  setMoveWeek,
  toggleStep,
  toggleWorkDoneForm,
  updateMove,
  updateTask,
} from "@/server/actions";
import { Hidden } from "./ui";

type Step = { id: string; title: string; done: boolean };
type Task = { id: string; title: string; durationMin: number; doneAt: Date | null; steps: Step[] };
export type MoveDetail = { id: string; title: string; weekOf: string | null; doneAt: Date | null; tasks: Task[] };

/** A Move in its column: its week, and its Tasks with their Steps. */
export function MovePanel({
  move,
  thisWeek,
  nextWeek,
  weekLabel,
}: {
  move: MoveDetail;
  thisWeek: string;
  nextWeek: string;
  weekLabel: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <form action={toggleWorkDoneForm}>
          <Hidden kind="move" id={move.id} />
          <button className="text-lg leading-none" title={move.doneAt ? "Mark not done" : "Mark done"}>
            {move.doneAt ? "☑" : "☐"}
          </button>
        </form>
        <form action={updateMove} className="flex min-w-0 flex-1 gap-2">
          <Hidden id={move.id} />
          <input
            name="title"
            defaultValue={move.title}
            required
            aria-label="Move title"
            className={`input font-medium ${move.doneAt ? "line-through opacity-60" : ""}`}
          />
          <button className="btn">Save</button>
        </form>
        <form action={deleteMove}>
          <Hidden id={move.id} />
          <button className="text-muted hover:text-red-600" title="Delete Move" aria-label={`Delete ${move.title}`}>
            ×
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Week:</span>
        {weekLabel ? (
          <span className="rounded bg-accent/15 px-1.5 text-xs text-accent">{weekLabel}</span>
        ) : (
          <span className="text-xs text-muted">not chosen</span>
        )}
        {move.weekOf !== thisWeek && <WeekButton id={move.id} weekOf={thisWeek} label="This week" />}
        {move.weekOf !== nextWeek && <WeekButton id={move.id} weekOf={nextWeek} label="Next week" />}
        {move.weekOf && <WeekButton id={move.id} weekOf="" label="Unchoose" />}
      </div>

      <div className="label">Tasks</div>
      {move.tasks.length === 0 && (
        <p className="text-sm text-muted">No Tasks: the Move goes to the calendar as a whole.</p>
      )}
      <ul className="flex flex-col gap-2">
        {move.tasks.map((task) => (
          <li key={task.id} className="rounded-md border border-line p-2">
            <div className="flex items-center gap-2">
              <form action={toggleWorkDoneForm}>
                <Hidden kind="task" id={task.id} />
                <button title={task.doneAt ? "Mark not done" : "Mark done"}>{task.doneAt ? "☑" : "☐"}</button>
              </form>
              <form action={updateTask} className="flex min-w-0 flex-1 gap-2">
                <Hidden id={task.id} />
                <input
                  name="title"
                  defaultValue={task.title}
                  aria-label="Task title"
                  className={`input ${task.doneAt ? "line-through opacity-60" : ""}`}
                />
                <input
                  name="durationMin"
                  type="number"
                  min={15}
                  step={15}
                  defaultValue={task.durationMin}
                  className="input w-20"
                  title="Duration (min)"
                  aria-label="Duration (min)"
                />
                <button className="btn">Save</button>
              </form>
              <form action={deleteTask}>
                <Hidden id={task.id} />
                <button className="text-muted hover:text-red-600" title="Delete Task" aria-label={`Delete ${task.title}`}>
                  ×
                </button>
              </form>
            </div>
            <ul className="mt-1 ml-6 flex flex-col gap-0.5 text-sm">
              {task.steps.map((step) => (
                <li key={step.id} className="flex items-center gap-2">
                  <form action={toggleStep}>
                    <Hidden id={step.id} />
                    <button>{step.done ? "☑" : "☐"}</button>
                  </form>
                  <span className={step.done ? "line-through opacity-60" : ""}>{step.title}</span>
                  <form action={deleteStep} className="ml-auto">
                    <Hidden id={step.id} />
                    <button className="text-muted hover:text-red-600" aria-label={`Delete ${step.title}`}>
                      ×
                    </button>
                  </form>
                </li>
              ))}
              <li>
                <form action={createStep} className="flex gap-2">
                  <Hidden taskId={task.id} />
                  <input name="title" required placeholder="Add a Step" className="input text-xs" />
                </form>
              </li>
            </ul>
          </li>
        ))}
      </ul>
      <form action={createTask} className="flex gap-2">
        <Hidden moveId={move.id} />
        <input name="title" required placeholder="Add a Task" className="input" />
        <input
          name="durationMin"
          type="number"
          min={15}
          step={15}
          defaultValue={60}
          className="input w-20"
          title="Duration (min)"
          aria-label="Duration (min)"
        />
        <button className="btn">Add</button>
      </form>
    </div>
  );
}

function WeekButton({ id, weekOf, label }: { id: string; weekOf: string; label: string }) {
  return (
    <form action={setMoveWeek}>
      <Hidden id={id} weekOf={weekOf} />
      <button className="btn">{label}</button>
    </form>
  );
}
