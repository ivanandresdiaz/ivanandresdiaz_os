"use client";

import { useState } from "react";
import { MAX_HIGHLIGHTS } from "@/domain/highlights";
import { addHighlight, deleteHighlight, toggleHighlight } from "@/server/actions";
import { AddIconButton, Hidden } from "./ui";

type HighlightView = { id: string; title: string; why: string; done: boolean };
type WorkOption = { value: string; label: string };

export function Highlights({
  date,
  highlights,
  workOptions,
}: {
  date: string;
  highlights: HighlightView[];
  workOptions: WorkOption[];
}) {
  const [adding, setAdding] = useState(false);
  const canAdd = highlights.length < MAX_HIGHLIGHTS;

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">
          Highlights <span className="text-sm font-normal text-muted">({highlights.length}/{MAX_HIGHLIGHTS})</span>
        </h2>
        {canAdd && !adding && <AddIconButton label="Add Highlight" onClick={() => setAdding(true)} />}
      </div>

      {highlights.map((h) => (
        <div key={h.id} className="flex items-start gap-2">
          <form action={toggleHighlight}>
            <Hidden id={h.id} />
            <button className="mt-0.5 text-lg leading-none" aria-label={h.done ? "Mark not done" : "Mark done"}>
              {h.done ? "☑" : "☐"}
            </button>
          </form>
          <div className="min-w-0 flex-1">
            <div className={`font-medium ${h.done ? "line-through opacity-60" : ""}`}>{h.title}</div>
            <div className="text-sm text-muted">Why: {h.why}</div>
          </div>
          <form action={deleteHighlight}>
            <Hidden id={h.id} />
            <button className="text-muted hover:text-red-600" title="Remove">
              ×
            </button>
          </form>
        </div>
      ))}

      {canAdd && adding && (
        <form
          action={async (fd) => {
            await addHighlight(fd);
            setAdding(false);
          }}
          onKeyDown={(event) => event.key === "Escape" && setAdding(false)}
          className="flex flex-col gap-2"
        >
          <Hidden date={date} />
          <input name="title" required autoFocus placeholder="What is critical to get done today?" className="input" />
          <input name="why" required placeholder="Why does it move the needle?" className="input" />
          <select name="work" className="input" defaultValue="">
            <option value="">Not linked to a Task or Move</option>
            {workOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button className="btn">Add</button>
            <button type="button" className="text-sm text-muted hover:underline" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
