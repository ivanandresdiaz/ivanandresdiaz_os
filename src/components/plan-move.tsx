"use client";

import { useState } from "react";
import { createTask, deleteMove, setMoveWeek, updateMove } from "@/server/actions";
import type { LinkView } from "@/server/queries";
import { AddSection } from "./add-section";
import { TaskList, TitleField } from "./plan-task";
import { Hidden, WeekChip } from "./ui";
import { AddMenu, DescriptionButton, DescriptionDrawer, DescriptionPreview, LinkForm, LinkList } from "./work-details";

type Step = { id: string; title: string; done: boolean };
type Task = {
  id: string;
  title: string;
  doneAt: Date | null;
  description: string;
  steps: Step[];
  links: LinkView[];
};
export type MoveDetail = {
  id: string;
  title: string;
  weekOf: string | null;
  doneAt: Date | null;
  description: string;
  links: LinkView[];
  tasks: Task[];
};

/**
 * A Move in its column: its title to read, its Description and Links, its week,
 * and its Tasks with their Steps. It is ticked done in the Campaign's list, not here.
 */
export function MovePanel({
  move,
  playing,
  thisWeek,
  nextWeek,
  weekLabel,
}: {
  move: MoveDetail;
  /** Its Campaign is active. A candidate's Moves get no week until it is activated. */
  playing: boolean;
  thisWeek: string;
  nextWeek: string;
  weekLabel: string | null;
}) {
  const [addingLink, setAddingLink] = useState(false);
  const [reading, setReading] = useState(false);
  const owner = { kind: "move", id: move.id, title: move.title } as const;
  const hasDescription = move.description.trim() !== "";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className={`text-lg leading-tight font-semibold ${move.doneAt ? "line-through opacity-60" : ""}`}>
            {move.title}
          </h3>
          {move.doneAt && <span className="text-xs text-muted">Done</span>}
        </div>
        {hasDescription && <DescriptionButton title={move.title} onClick={() => setReading(true)} />}
        <AddMenu
          label={`Add to ${move.title}`}
          options={[
            ...(hasDescription ? [] : [{ label: "Description", onSelect: () => setReading(true) }]),
            { label: "Link", onSelect: () => setAddingLink(true) },
          ]}
        />
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

      {hasDescription && <DescriptionPreview description={move.description} onOpen={() => setReading(true)} />}

      {playing ? (
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
      ) : (
        <p className="text-xs text-muted">Its week is chosen once the Campaign is active.</p>
      )}

      {(move.links.length > 0 || addingLink) && (
        <div className="flex flex-col gap-1">
          <LinkList links={move.links} />
          {addingLink && <LinkForm owner={owner} onDone={() => setAddingLink(false)} />}
        </div>
      )}
      {reading && <DescriptionDrawer owner={owner} description={move.description} onClose={() => setReading(false)} />}

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
        {move.tasks.length > 0 && (
          <TaskList
            tasks={move.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              done: task.doneAt !== null,
              description: task.description,
              steps: task.steps,
              links: task.links,
            }))}
          />
        )}
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
