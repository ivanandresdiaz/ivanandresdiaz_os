import { createTask, deleteMove, setMoveWeek, updateMove } from "@/server/actions";
import { AddSection } from "./add-section";
import { TaskItem, TitleField } from "./plan-task";
import { Hidden, WeekChip } from "./ui";

type Step = { id: string; title: string; done: boolean };
type Task = { id: string; title: string; doneAt: Date | null; steps: Step[] };
export type MoveDetail = { id: string; title: string; weekOf: string | null; doneAt: Date | null; tasks: Task[] };

/**
 * A Move in its column: its title to read, its week, and its Tasks with their Steps.
 * It is ticked done in the Campaign's list, not here.
 */
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
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className={`text-lg leading-tight font-semibold ${move.doneAt ? "line-through opacity-60" : ""}`}>
            {move.title}
          </h3>
          {move.doneAt && <span className="text-xs text-muted">Done</span>}
        </div>
        {/* Keyed by the title: once renamed, it closes. */}
        <details key={move.title} className="relative">
          <summary
            title="Rename Move"
            aria-label={`Rename ${move.title}`}
            className="cursor-pointer list-none rounded px-1 text-muted hover:bg-line hover:text-foreground [&::-webkit-details-marker]:hidden"
          >
            ✎
          </summary>
          <div className="absolute right-0 z-10 mt-1 flex w-72 rounded-md border border-line bg-surface p-2 shadow-lg">
            <TitleField id={move.id} title={move.title} label="Move title" action={updateMove} autoFocus />
          </div>
        </details>
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
          <WeekChip label={weekLabel} now={move.weekOf === thisWeek} />
        ) : (
          <span className="text-xs text-muted">not chosen</span>
        )}
        {move.weekOf !== thisWeek && <WeekButton id={move.id} weekOf={thisWeek} label="This week" />}
        {move.weekOf !== nextWeek && <WeekButton id={move.id} weekOf={nextWeek} label="Next week" />}
        {move.weekOf && <WeekButton id={move.id} weekOf="" label="Unchoose" />}
      </div>

      <AddSection
        heading={<div className="label">Tasks</div>}
        addLabel={`Add a Task to ${move.title}`}
        form={
          // A new Task lasts an hour; it is stretched or shortened in the calendar.
          <form action={createTask} className="flex gap-2">
            <Hidden moveId={move.id} />
            <input name="title" required autoFocus placeholder="New Task" aria-label="New Task" className="input" />
            <button className="btn">Add</button>
          </form>
        }
      >
        {move.tasks.length === 0 && (
          <p className="text-sm text-muted">No Tasks: the Move goes to the calendar as a whole.</p>
        )}
        <ul className="flex flex-col gap-2 empty:hidden">
          {move.tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={{ id: task.id, title: task.title, done: task.doneAt !== null, steps: task.steps }}
            />
          ))}
        </ul>
      </AddSection>
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
