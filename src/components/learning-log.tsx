"use client";

import { useState } from "react";
import { formatMinutes, WEEKDAY_NAMES, weekdayOf } from "@/domain/dates";
import { addLearningEntry, deleteLearningEntry, updateLearningEntry } from "@/server/actions";
import type { LearningEntry } from "@/server/queries";
import { LearningEntryDrawer, type LearningDrawerTarget } from "./learning-entry-drawer";
import { AddIconButton, Hidden } from "./ui";

const hasExpansion = (entry: LearningEntry) => entry.expansion.trim() !== "";
const drawerOn = (entry: LearningEntry): LearningDrawerTarget => ({
  kind: "entry",
  id: entry.id,
  title: entry.title,
  expansion: entry.expansion,
});

/**
 * Quick capture during the day: one line per idea, reflection or thing learned.
 * Only the titles show; an entry that needs more room opens in the drawer.
 */
export function LearningLog({ date, entries }: { date: string; entries: LearningEntry[] }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<LearningDrawerTarget | null>(null);

  function remove(entry: LearningEntry) {
    if (hasExpansion(entry) && !window.confirm(`Delete "${entry.title}" and its Expansion?`)) return;
    deleteLearningEntry({ id: entry.id });
  }

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
                    name="title"
                    required
                    autoFocus
                    maxLength={1000}
                    defaultValue={entry.title}
                    aria-label="Learning entry title"
                    className="input min-w-0 flex-1"
                    onKeyDown={(event) => event.key === "Escape" && setEditing(null)}
                  />
                  <button className="btn">Save</button>
                </form>
              </li>
            ) : (
              <li key={entry.id} className="flex items-start gap-2 rounded-md border border-line px-2 py-1.5 text-sm">
                <span className="shrink-0 text-xs leading-5 text-muted">{formatMinutes(entry.minute)}</span>
                <button
                  type="button"
                  onClick={() => setDrawer(drawerOn(entry))}
                  title={hasExpansion(entry) ? "Open the Expansion" : "More room: write its Expansion"}
                  className="min-w-0 flex-1 cursor-pointer break-words text-left"
                >
                  {entry.title}
                </button>
                <ExpansionButton entry={entry} onOpen={() => setDrawer(drawerOn(entry))} />
                <button
                  type="button"
                  className="text-muted hover:text-foreground"
                  onClick={() => setEditing(entry.id)}
                  title="Edit entry"
                  aria-label={`Edit ${entry.title}`}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="text-muted hover:text-red-600"
                  onClick={() => remove(entry)}
                  title="Delete entry"
                  aria-label={`Delete ${entry.title}`}
                >
                  ×
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {adding && (
        <form
          action={async (fd) => {
            await addLearningEntry(fd);
            setDraft("");
          }}
          className="flex gap-2"
        >
          <Hidden date={date} />
          <input
            name="title"
            required
            autoFocus
            maxLength={1000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What am I learning?"
            aria-label="What am I learning?"
            className="input min-w-0 flex-1"
            onKeyDown={(event) => event.key === "Escape" && setAdding(false)}
          />
          <button
            type="button"
            className="btn"
            onClick={() => {
              setDrawer({ kind: "new", date, title: draft });
              setDraft("");
              setAdding(false);
            }}
            title="More room: write its Expansion"
            aria-label="Expand into the drawer"
          >
            ⤢
          </button>
          <button className="btn">Add</button>
          <button type="button" className="text-sm text-muted hover:underline" onClick={() => setAdding(false)}>
            Done
          </button>
        </form>
      )}

      <LearningEntryDrawer target={drawer} onClose={() => setDrawer(null)} />
    </section>
  );
}

/**
 * The week's Learning Log in the Weekly Review: titles only, and the Expansion
 * of an entry opens to be read, not edited.
 */
export function ReviewLearningEntries({ entries }: { entries: LearningEntry[] }) {
  const [drawer, setDrawer] = useState<LearningDrawerTarget | null>(null);
  return (
    <>
      <ul className="flex flex-col gap-1 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className="flex gap-2">
            <span className="w-8 shrink-0 text-xs leading-5 text-muted">{WEEKDAY_NAMES[weekdayOf(entry.date)].slice(0, 3)}</span>
            <span className="min-w-0 flex-1 break-words">{entry.title}</span>
            <ExpansionButton entry={entry} onOpen={() => setDrawer(drawerOn(entry))} />
          </li>
        ))}
      </ul>
      <LearningEntryDrawer target={drawer} readOnly onClose={() => setDrawer(null)} />
    </>
  );
}

/** The ≡ of an entry that has an Expansion; nothing when it has none. */
function ExpansionButton({ entry, onOpen }: { entry: LearningEntry; onOpen: () => void }) {
  if (!hasExpansion(entry)) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Expansion"
      aria-label={`Expansion of ${entry.title}`}
      className="-my-0.5 flex size-6 shrink-0 items-center justify-center rounded-md leading-none text-muted hover:bg-line hover:text-foreground"
    >
      ≡
    </button>
  );
}
