"use client";

import { useState, useTransition } from "react";
import { createStep, deleteStep, deleteTask, toggleStep, toggleWorkDoneForm, updateTask } from "@/server/actions";
import type { LinkView } from "@/server/queries";
import { GameTags, Hidden } from "./ui";
import { AddMenu, DescriptionButton, DescriptionDrawer, DescriptionPreview, LinkForm, LinkList } from "./work-details";

export type TaskItemData = {
  id: string;
  title: string;
  done: boolean;
  steps: { id: string; title: string; done: boolean }[];
  description: string;
  links: LinkView[];
  /** A loose Task shows its Infinite Games; a Move's Task plays in its Campaign's. */
  games?: readonly string[];
};

/**
 * A title to edit in place: Save shows only once it changed, Enter saves, Escape undoes.
 * `action` gets the FormData with `id` and `title`.
 */
export function TitleField({
  id,
  title: saved,
  label,
  action,
  className = "",
  autoFocus,
}: {
  id: string;
  title: string;
  label: string;
  action: (fd: FormData) => Promise<void>;
  className?: string;
  autoFocus?: boolean;
}) {
  const [title, setTitle] = useState(saved);
  const [saving, startSaving] = useTransition();
  const changed = title.trim() !== "" && title.trim() !== saved;

  return (
    <form
      className="flex min-w-0 flex-1 gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!changed) return;
        const fd = new FormData();
        fd.set("id", id);
        fd.set("title", title.trim());
        startSaving(async () => {
          await action(fd);
          setTitle(title.trim());
        });
      }}
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && setTitle(saved)}
        required
        autoFocus={autoFocus}
        aria-label={label}
        className={`input ${className}`}
      />
      {changed && (
        <button className="btn" disabled={saving}>
          Save
        </button>
      )}
    </form>
  );
}

/**
 * A Task, in a Move or loose in the Backlog: done, title, and what it holds.
 * Its + adds a Step, its Description or a Link. Its length is set in the calendar.
 */
export function TaskItem({ task }: { task: TaskItemData }) {
  const [adding, setAdding] = useState<"step" | "link" | null>(null);
  const [reading, setReading] = useState(false);
  const owner = { kind: "task", id: task.id, title: task.title } as const;
  const hasDescription = task.description.trim() !== "";
  return (
    <li className="rounded-md border border-line p-2">
      <div className="flex items-center gap-2">
        <form action={toggleWorkDoneForm}>
          <Hidden kind="task" id={task.id} />
          <button title={task.done ? "Mark not done" : "Mark done"}>{task.done ? "☑" : "☐"}</button>
        </form>
        <TitleField
          id={task.id}
          title={task.title}
          label="Task title"
          action={updateTask}
          className={task.done ? "line-through opacity-60" : ""}
        />
        {hasDescription && <DescriptionButton title={task.title} onClick={() => setReading(true)} />}
        <AddMenu
          label={`Add to ${task.title}`}
          options={[
            { label: "Step", onSelect: () => setAdding("step") },
            ...(hasDescription ? [] : [{ label: "Description", onSelect: () => setReading(true) }]),
            { label: "Link", onSelect: () => setAdding("link") },
          ]}
        />
        <form action={deleteTask}>
          <Hidden id={task.id} />
          <button className="text-muted hover:text-red-600" title="Delete Task" aria-label={`Delete ${task.title}`}>
            ×
          </button>
        </form>
      </div>
      {task.games && task.games.length > 0 && (
        <div className="mt-1 ml-6">
          <GameTags games={task.games} />
        </div>
      )}
      {hasDescription && (
        <DescriptionPreview description={task.description} onOpen={() => setReading(true)} className="mt-1 ml-6" />
      )}
      {(task.steps.length > 0 || adding === "step") && (
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
          {adding === "step" && (
            <li>
              {/* It stays open after Enter, to add the next Step; empty, it closes on leaving. */}
              <form action={createStep}>
                <Hidden taskId={task.id} />
                <input
                  name="title"
                  required
                  autoFocus
                  placeholder="New Step"
                  aria-label="New Step"
                  className="input text-xs"
                  onKeyDown={(event) => event.key === "Escape" && setAdding(null)}
                  onBlur={(event) => event.currentTarget.value.trim() === "" && setAdding(null)}
                />
              </form>
            </li>
          )}
        </ul>
      )}
      <LinkList links={task.links} className="mt-1 ml-6" />
      {adding === "link" && (
        <div className="mt-1 ml-6">
          <LinkForm owner={owner} onDone={() => setAdding(null)} />
        </div>
      )}
      {reading && <DescriptionDrawer owner={owner} description={task.description} onClose={() => setReading(false)} />}
    </li>
  );
}
