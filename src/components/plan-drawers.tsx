"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addSeasonGoal, deleteSeasonGoal, saveQuarter, updateSeason, updateSeasonGoal } from "@/server/actions";
import { LongText } from "./long-text";
import { Markdown } from "./markdown";
import { Hidden } from "./ui";

export type SeasonText = {
  id: string;
  title: string;
  body: string;
  startedOn: string;
  endedOn: string | null;
  goals: { id: string; title: string }[];
};

export type QuarterText = {
  year: number;
  quarter: number;
  label: string;
  start: string;
  end: string;
  title: string;
  body: string;
};

/** "Read" opens the Season in a drawer; its Edit mode writes the text and the Season Goals. */
export function SeasonReader({ season }: { season: SeasonText }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ReadButton label={`Read ${season.title}`} onClick={() => setOpen(true)} />
      {open && <SeasonDrawer season={season} onClose={() => setOpen(false)} />}
    </>
  );
}

/** "Read" opens the Quarter in a drawer; saving it creates the Quarter if it did not exist. */
export function QuarterReader({ quarter }: { quarter: QuarterText }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ReadButton label={`Read ${quarter.label}`} onClick={() => setOpen(true)} />
      {open && <QuarterDrawer quarter={quarter} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ReadButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="min-h-8 shrink-0 rounded-md px-2 text-xs text-muted hover:bg-line hover:text-foreground"
    >
      Read
    </button>
  );
}

function SeasonDrawer({ season, onClose }: { season: SeasonText; onClose: () => void }) {
  const [title, setTitle] = useState(season.title);
  const [body, setBody] = useState(season.body);
  const dirty = title !== season.title || body !== season.body;

  return (
    <TextDrawer
      heading={title.trim() || season.title}
      dates={season.endedOn ? `${season.startedOn} → ${season.endedOn}` : `Since ${season.startedOn}`}
      body={body}
      empty="No text yet. Switch to Edit to write your reality right now."
      dirty={dirty}
      canSave={title.trim() !== ""}
      onDiscard={() => {
        setTitle(season.title);
        setBody(season.body);
      }}
      onSave={async () => {
        const fd = new FormData();
        fd.set("id", season.id);
        fd.set("title", title);
        fd.set("body", body);
        await updateSeason(fd);
        setTitle(title.trim());
        setBody(body.trim());
      }}
      onClose={onClose}
      preview={
        season.goals.length > 0 && (
          <div>
            <div className="label mb-1">Season Goals</div>
            <ol className="list-decimal pl-5 text-sm">
              {season.goals.map((goal) => (
                <li key={goal.id}>{goal.title}</li>
              ))}
            </ol>
          </div>
        )
      }
      fields={
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          aria-label="Season title"
          className="input font-medium"
        />
      }
      bodyLabel="My reality right now"
      placeholder="My reality right now: career, emotional state, questions about myself…"
      after={<SeasonGoalsEditor season={season} />}
      setBody={setBody}
    />
  );
}

/** The Season Goals save one by one, apart from the Season's text. */
function SeasonGoalsEditor({ season }: { season: SeasonText }) {
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-4">
      <div className="label mb-1">Season Goals</div>
      {season.goals.map((goal) => (
        <div key={goal.id} className="flex items-center gap-2">
          <form action={updateSeasonGoal} className="flex flex-1 gap-2">
            <Hidden id={goal.id} />
            <input name="title" defaultValue={goal.title} required aria-label="Season Goal" className="input" />
            <button className="btn">Save</button>
          </form>
          <form action={deleteSeasonGoal}>
            <Hidden id={goal.id} />
            <button className="text-muted hover:text-red-600" title="Delete" aria-label={`Delete ${goal.title}`}>
              ×
            </button>
          </form>
        </div>
      ))}
      <form action={addSeasonGoal} className="mt-1 flex gap-2">
        <Hidden seasonId={season.id} />
        <input name="title" required placeholder="New Season Goal (e.g. make 30,000)" className="input" />
        <button className="btn">Add</button>
      </form>
    </div>
  );
}

function QuarterDrawer({ quarter, onClose }: { quarter: QuarterText; onClose: () => void }) {
  const [title, setTitle] = useState(quarter.title);
  const [body, setBody] = useState(quarter.body);
  const dirty = title !== quarter.title || body !== quarter.body;

  return (
    <TextDrawer
      heading={title.trim() ? `${quarter.label} · ${title.trim()}` : quarter.label}
      dates={`${quarter.start} → ${quarter.end}`}
      body={body}
      empty="No text yet. Switch to Edit to write what these 3 months are about."
      dirty={dirty}
      canSave
      onDiscard={() => {
        setTitle(quarter.title);
        setBody(quarter.body);
      }}
      onSave={async () => {
        const fd = new FormData();
        fd.set("year", String(quarter.year));
        fd.set("quarter", String(quarter.quarter));
        fd.set("title", title);
        fd.set("body", body);
        await saveQuarter(fd);
        setTitle(title.trim());
        setBody(body.trim());
      }}
      onClose={onClose}
      fields={
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title of the Quarter"
          aria-label="Quarter title"
          className="input font-medium"
        />
      }
      bodyLabel="What these 3 months are about"
      placeholder="What these 3 months are about…"
      setBody={setBody}
    />
  );
}

export type Mode = "preview" | "edit";

/** Preview or Edit, asking before unsaved changes are thrown away. */
export function useEditMode(dirty: boolean, discard: () => void) {
  const [mode, setMode] = useState<Mode>("preview");

  function confirmDiscard() {
    if (!dirty) return true;
    if (!window.confirm("Discard the unsaved changes?")) return false;
    discard();
    return true;
  }

  function switchTo(next: Mode) {
    if (next === mode) return;
    if (next === "preview" && !confirmDiscard()) return;
    setMode(next);
  }

  return { mode, setMode, switchTo, confirmDiscard };
}

/** The side drawer of the Plan: a heading, the Preview/Edit switch and a close button. */
export function DrawerFrame({
  heading,
  subheading,
  mode,
  onSwitch,
  onRequestClose,
  onClose,
  children,
}: {
  heading: string;
  subheading: string;
  mode: Mode;
  onSwitch: (mode: Mode) => void;
  onRequestClose: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label={heading}
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onRequestClose()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[640px] translate-x-0 border-l border-line bg-surface p-0 text-foreground transition-transform duration-200 ease-out backdrop:bg-black/40 starting:translate-x-full motion-reduce:transition-none"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">{heading}</h2>
            <div className="text-xs text-muted">{subheading}</div>
          </div>
          <div role="group" aria-label="Mode" className="flex rounded-md border border-line p-0.5 text-sm">
            {(["preview", "edit"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => onSwitch(m)}
                className={`rounded px-2 py-0.5 capitalize ${mode === m ? "bg-line text-foreground" : "text-muted hover:text-foreground"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Close"
            title="Close"
            className="text-lg leading-none text-muted hover:text-foreground"
          >
            ×
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  );
}

/** Saves with the button or with Ctrl/⌘+S. */
export function SaveForm({
  onSave,
  dirty,
  saving,
  canSave,
  children,
  formRef,
}: {
  onSave: () => void;
  dirty: boolean;
  saving: boolean;
  canSave: boolean;
  children: React.ReactNode;
  formRef?: React.Ref<HTMLFormElement>;
}) {
  return (
    <form
      ref={formRef}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "s") {
          event.preventDefault();
          onSave();
        }
      }}
    >
      {children}
      <div className="flex items-center gap-3">
        <button className="btn" disabled={!dirty || saving || !canSave}>
          {saving ? "Saving…" : "Save"}
        </button>
        {dirty && !saving && <span className="text-xs text-muted">Unsaved changes</span>}
      </div>
    </form>
  );
}

/** The drawer shared by the Season and the Quarter: one long text to read, or to edit in place. */
function TextDrawer({
  heading,
  dates,
  body,
  empty,
  dirty,
  canSave,
  onDiscard,
  onSave,
  onClose,
  preview,
  fields,
  bodyLabel,
  placeholder,
  after,
  setBody,
}: {
  heading: string;
  dates: string;
  body: string;
  empty: string;
  dirty: boolean;
  canSave: boolean;
  onDiscard: () => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  preview?: React.ReactNode;
  fields: React.ReactNode;
  bodyLabel: string;
  placeholder: string;
  after?: React.ReactNode;
  setBody: (value: string) => void;
}) {
  const { mode, setMode, switchTo, confirmDiscard } = useEditMode(dirty, onDiscard);
  const [saving, startSaving] = useTransition();

  function save() {
    if (!dirty || !canSave) return;
    startSaving(async () => {
      await onSave();
      setMode("preview");
    });
  }

  return (
    <DrawerFrame
      heading={heading}
      subheading={dates}
      mode={mode}
      onSwitch={switchTo}
      onRequestClose={() => confirmDiscard() && onClose()}
      onClose={onClose}
    >
      {mode === "preview" ? (
        <>
          {preview}
          {body.trim() ? <Markdown>{body}</Markdown> : <p className="text-sm text-muted">{empty}</p>}
        </>
      ) : (
        <>
          <SaveForm onSave={save} dirty={dirty} saving={saving} canSave={canSave}>
            {fields}
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <span className="label">{bodyLabel}</span>
                <span className="text-xs text-muted">Markdown</span>
              </div>
              <LongText
                value={body}
                onValueChange={setBody}
                markdown
                aria-label={bodyLabel}
                placeholder={placeholder}
                className="input min-h-72 font-mono leading-relaxed"
              />
            </div>
          </SaveForm>
          {after}
        </>
      )}
    </DrawerFrame>
  );
}
