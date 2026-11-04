"use client";

import { useState } from "react";
import { formatMinutes } from "@/domain/dates";
import { addLearningEntry, deleteLearningEntry, updateLearningEntry } from "@/server/actions";
import type { LearningEntry } from "@/server/queries";
import { AddIconButton, Hidden } from "./ui";

/** Quick capture during the day: one line per idea, reflection or thing learned. */
export function LearningLog({ date, entries }: { date: string; entries: LearningEntry[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">Learning Log</h2>
        {!adding && <AddIconButton label="Add to the Learning Log" onClick={() => setAdding(true)} />}
      </div>

      {entries.length > 0 && (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) =>
            editing === entry.id ? (
              <li key={entry.id}>
                <form
                  action={async (fd) => {
                    await updateLearningEntry(fd);
                    setEditing(null);
                  }}
                  className="flex gap-2"
                >
                  <Hidden id={entry.id} />
                  <input
                    name="body"
                    required
                    autoFocus
                    maxLength={1000}
                    defaultValue={entry.body}
                    aria-label="Learning Log entry"
                    className="input min-w-0 flex-1"
                    onKeyDown={(event) => event.key === "Escape" && setEditing(null)}
                  />
                  <button className="btn">Save</button>
                </form>
              </li>
            ) : (
              <li key={entry.id} className="flex items-start gap-2 rounded-md border border-line px-2 py-1.5 text-sm">
                <span className="shrink-0 text-xs leading-5 text-muted">{formatMinutes(entry.minute)}</span>
                <span className="min-w-0 flex-1 break-words">{entry.body}</span>
                <button
                  type="button"
                  className="text-muted hover:text-foreground"
                  onClick={() => setEditing(entry.id)}
                  title="Edit entry"
                  aria-label={`Edit ${entry.body}`}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="text-muted hover:text-red-600"
                  onClick={() => deleteLearningEntry({ id: entry.id })}
                  title="Delete entry"
                  aria-label={`Delete ${entry.body}`}
                >
                  ×
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {adding && (
        <form action={addLearningEntry} className="flex gap-2">
          <Hidden date={date} />
          <input
            name="body"
            required
            autoFocus
            maxLength={1000}
            placeholder="What am I learning?"
            aria-label="What am I learning?"
            className="input min-w-0 flex-1"
            onKeyDown={(event) => event.key === "Escape" && setAdding(false)}
          />
          <button className="btn">Add</button>
          <button type="button" className="text-sm text-muted hover:underline" onClick={() => setAdding(false)}>
            Done
          </button>
        </form>
      )}
    </section>
  );
}
