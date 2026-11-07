"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { formatMinutes, type IsoDate } from "@/domain/dates";
import { MAX_HIGHLIGHTS } from "@/domain/highlights";
import { deleteHighlight, setHighlight } from "@/server/actions";
import { LongText } from "./long-text";

const keep = {
  onPointerDown: (event: React.SyntheticEvent) => event.stopPropagation(),
  onClick: (event: React.SyntheticEvent) => event.stopPropagation(),
  onKeyDown: (event: React.SyntheticEvent) => event.stopPropagation(),
};

export function StarIcon({ filled = false, className = "" }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-3 ${className}`}>
      <path
        d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A Slot's star in the calendar: it makes the Slot's Task or Move a Highlight
 * of that day. Off, it shows on hover (always on a touch screen) on today and
 * later days, never on done work; on, it stays and opens to edit the why or
 * remove it. A day with 3 Highlights leaves the others' stars disabled.
 */
export function HighlightStar({
  slot,
  title,
  campaignTitle,
  done,
  today,
  dayCount,
}: {
  slot: {
    date: IsoDate;
    startMin: number;
    work: { kind: "task" | "move"; id: string };
    highlight: { id: string; why: string } | null;
  };
  title: string;
  campaignTitle: string | null;
  done: boolean;
  today: IsoDate;
  /** Highlights the Slot's day already has. */
  dayCount: number;
}) {
  const [open, setOpen] = useState(false);
  const on = slot.highlight !== null;
  if (!on && (done || slot.date < today)) return null;
  const full = !on && dayCount >= MAX_HIGHLIGHTS;

  return (
    <>
      <button
        type="button"
        {...keep}
        disabled={full}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={`items-center leading-none ${
          on
            ? "inline-flex text-amber-500 hover:text-amber-600"
            : "hidden text-muted/60 group-hover:inline-flex hover:text-foreground disabled:cursor-not-allowed disabled:hover:text-muted/60 pointer-coarse:inline-flex"
        }`}
        title={
          on
            ? slot.highlight?.why.trim()
              ? `Highlight: ${slot.highlight.why.trim().split("\n")[0]}`
              : "Highlight"
            : full
              ? `${MAX_HIGHLIGHTS} Highlights already`
              : "Make it a Highlight"
        }
        aria-label={on ? `${title} is a Highlight` : full ? `${MAX_HIGHLIGHTS} Highlights already` : `Make ${title} a Highlight`}
      >
        <StarIcon filled={on} />
      </button>
      {open && (
        <div className="contents" {...keep}>
          <HighlightDialog
            date={slot.date}
            startMin={slot.startMin}
            work={slot.work}
            highlight={slot.highlight}
            title={title}
            campaignTitle={campaignTitle}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}

/**
 * Makes a piece of work a Highlight of `date`, or edits the why of the one it
 * is (opened from the star of a Slot, or from the Check-in). The why is an
 * optional Long text: Cmd/Ctrl+Enter saves.
 */
export function HighlightDialog({
  date,
  startMin,
  work,
  highlight,
  title,
  campaignTitle,
  onClose,
}: {
  date: IsoDate;
  /** The Slot it was opened from; null from the Check-in. */
  startMin: number | null;
  work: { kind: "task" | "move"; id: string };
  highlight: { id: string; why: string } | null;
  title: string;
  campaignTitle: string | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [why, setWhy] = useState(highlight?.why ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await setHighlight({ kind: work.kind, id: work.id, date, why });
        dialog.current?.close();
      } catch {
        setError(`Could not make it a Highlight: the day may already have ${MAX_HIGHLIGHTS}.`);
      }
    });
  }

  function remove() {
    if (!highlight) return;
    const fd = new FormData();
    fd.set("id", highlight.id);
    startTransition(async () => {
      await deleteHighlight(fd);
      dialog.current?.close();
    });
  }

  return (
    <dialog
      ref={dialog}
      aria-label={`Highlight: ${title}`}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <form
        className="flex flex-col gap-3 p-4 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            save();
          }
        }}
      >
        <h2 className="flex items-start gap-1.5 font-semibold">
          <StarIcon filled className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          <span className="min-w-0 flex-1">
            <span className="break-words">{title}</span>
            <span className="block text-xs font-normal text-muted">
              {campaignTitle ? `${campaignTitle} · ` : ""}
              {date}
              {startMin !== null ? ` · ${formatMinutes(startMin)}` : ""}
            </span>
          </span>
        </h2>
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <span className="label">Why is it key? (optional)</span>
            <span className="text-xs text-muted">Markdown · ⌘/Ctrl+Enter saves</span>
          </div>
          <LongText
            value={why}
            onValueChange={setWhy}
            autoFocus
            markdown
            aria-label="Why is it key?"
            placeholder="It already serves its Campaign; say more if you want."
            className="input min-h-32 leading-relaxed"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-2">
          <button className="btn" disabled={pending}>
            {highlight ? "Save" : "Make it a Highlight"}
          </button>
          {highlight && (
            <button
              type="button"
              className="text-sm text-muted hover:text-red-600"
              disabled={pending}
              onClick={remove}
            >
              Remove Highlight
            </button>
          )}
          <button
            type="button"
            className="ml-auto text-sm text-muted hover:underline"
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
