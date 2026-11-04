"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { WEEKDAY_NAMES, weekdayOf } from "@/domain/dates";
import { saveJournal } from "@/server/actions";
import { LongText } from "./long-text";
import { Markdown } from "./markdown";
import { DrawerFrame, SaveForm, useEditMode } from "./plan-drawers";

type Props = {
  date: string;
  journal: string;
  /** The closest days with a Journal, to read through them. */
  previous: string | null;
  next: string | null;
  /** Reached with the arrows of another day's Journal: it comes open. */
  startOpen: boolean;
};

/** The Journal of the day: its first line here, the whole text in a drawer. */
export function JournalCard({ date, journal, previous, next, startOpen }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const firstLine = journal.split("\n").find((line) => line.trim() !== "");

  return (
    <section className="card">
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        <h2 className="font-semibold">Journal</h2>
        <p className="truncate text-sm text-muted">{firstLine ?? "Write about the day."}</p>
      </button>
      {open && (
        <JournalDrawer
          date={date}
          saved={journal}
          previous={previous}
          next={next}
          onClose={() => {
            setOpen(false);
            // Otherwise a reload would open it again.
            if (startOpen) router.replace(`/os/day/${date}`, { scroll: false });
          }}
        />
      )}
    </section>
  );
}

function JournalDrawer({
  date,
  saved,
  previous,
  next,
  onClose,
}: {
  date: string;
  saved: string;
  previous: string | null;
  next: string | null;
  onClose: () => void;
}) {
  const [text, setText] = useState(saved);
  const [saving, startSaving] = useTransition();
  const dirty = text.trim() !== saved.trim();
  const { mode, setMode, switchTo, confirmDiscard } = useEditMode(dirty, () => setText(saved), saved ? "preview" : "edit");
  const editor = useRef<HTMLDivElement>(null);

  // Opening the dialog focuses its first button; writing starts in the text instead.
  useEffect(() => {
    if (mode !== "edit") return;
    const frame = requestAnimationFrame(() => editor.current?.querySelector("textarea")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  function save() {
    if (!dirty) return;
    startSaving(async () => {
      await saveJournal({ date, journal: text });
      setText(text.trim());
      if (text.trim() !== "") setMode("preview");
    });
  }

  const arrow = (to: string | null, label: string, glyph: string) =>
    to && (
      <Link
        href={`/os/day/${to}?journal=open`}
        scroll={false}
        aria-label={label}
        title={`${label}: ${to}`}
        onClick={(event) => {
          if (!confirmDiscard()) event.preventDefault();
        }}
        className="rounded px-1.5 text-muted hover:bg-line hover:text-foreground"
      >
        {glyph}
      </Link>
    );

  return (
    <DrawerFrame
      heading="Journal"
      subheading={`${WEEKDAY_NAMES[weekdayOf(date)]} ${date}`}
      mode={mode}
      onSwitch={switchTo}
      onRequestClose={() => confirmDiscard() && onClose()}
      onClose={onClose}
      navigation={
        <div className="flex items-center gap-1">
          {arrow(previous, "Previous Journal", "←")}
          {arrow(next, "Next Journal", "→")}
        </div>
      }
    >
      {mode === "preview" ? (
        text.trim() ? (
          <Markdown>{text}</Markdown>
        ) : (
          <p className="text-sm text-muted">Nothing written this day.</p>
        )
      ) : (
        <SaveForm onSave={save} dirty={dirty} saving={saving} canSave>
          <div ref={editor} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-end">
              <span className="text-xs text-muted">Markdown</span>
            </div>
            <LongText
              value={text}
              onValueChange={setText}
              markdown
              aria-label="Journal"
              placeholder="Write about the day…"
              className="input min-h-72 leading-relaxed"
            />
          </div>
        </SaveForm>
      )}
    </DrawerFrame>
  );
}
