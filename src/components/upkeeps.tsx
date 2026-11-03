"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { addDays, monthOf, type IsoDate } from "@/domain/dates";
import {
  DEFAULT_INTERVAL_DAYS,
  intervalLabel,
  isValidInterval,
  MAX_INTERVAL_DAYS,
  type UpkeepRef,
} from "@/domain/upkeeps";
import { completeUpkeepOccurrence, createUpkeep, stopUpkeep, toggleWorkDone, updateUpkeep } from "@/server/actions";
import type { UpkeepView } from "@/server/queries";
import { AddIconButton, Hidden } from "./ui";

/** "Tue, Feb 2", with the year only when it is not this year's. */
export function shortDate(date: IsoDate, today: IsoDate): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: date.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** The link to an Upkeep: opens the Month's drawer on it. */
export function upkeepHref(upkeepId: string, month: string) {
  return `/os/month/${month}?upkeep=${upkeepId}`;
}

/** The small ↻ beside an occurrence; it opens its Upkeep. No color: color is the priority. */
export function UpkeepMark({ upkeepId, date }: { upkeepId: string; date: IsoDate }) {
  return (
    <Link
      href={upkeepHref(upkeepId, monthOf(date))}
      className="ml-1 text-muted hover:text-foreground"
      title="Upkeep: open it"
      aria-label="Open its Upkeep"
      onPointerDown={(event) => event.stopPropagation()}
    >
      ↻
    </Link>
  );
}

type Occurrence = { id: string; title: string; upkeep: UpkeepRef | null; done: boolean };

/**
 * Ticking a Secondary Task. An occurrence of an Upkeep asks first, in a modal,
 * when the next one is due; everything else toggles straight away.
 */
export function useDoneToggle(today: IsoDate) {
  const [asking, setAsking] = useState<{ id: string; title: string; intervalDays: number } | null>(null);

  function toggle(work: Occurrence) {
    if (work.upkeep && !work.done) {
      setAsking({ id: work.id, title: work.title, intervalDays: work.upkeep.intervalDays });
      return;
    }
    void toggleWorkDone({ kind: "secondary", id: work.id });
  }

  // React events bubble from the modal to whatever holds it (a draggable Slot, a row): keep them in.
  const dialog = asking ? (
    <div
      className="contents"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <UpkeepDoneDialog occurrence={asking} today={today} onClose={() => setAsking(null)} />
    </div>
  ) : null;

  return { toggle, dialog };
}

function UpkeepDoneDialog({
  occurrence,
  today,
  onClose,
}: {
  occurrence: { id: string; title: string; intervalDays: number };
  today: IsoDate;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [days, setDays] = useState(String(occurrence.intervalDays));
  const [pending, startTransition] = useTransition();
  const interval = Number(days);
  const valid = isValidInterval(interval);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label={`${occurrence.title} done`}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          startTransition(async () => {
            await completeUpkeepOccurrence({ id: occurrence.id, intervalDays: interval });
            dialog.current?.close();
          });
        }}
      >
        <h2 className="font-semibold">
          Done: <span className="font-normal">{occurrence.title}</span>
        </h2>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          Next in
          <input
            type="number"
            min={1}
            max={MAX_INTERVAL_DAYS}
            required
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="input w-20 tabular-nums"
            aria-label="Days until the next one"
          />
          days
          {valid && <span className="text-muted">→ {shortDate(addDays(today, interval), today)}</span>}
        </label>
        {valid && interval !== occurrence.intervalDays && (
          <p className="text-xs text-muted">From now on it repeats {intervalLabel(interval)}.</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button className="btn-primary disabled:opacity-50" disabled={!valid || pending}>
            {pending ? "Saving…" : "Done"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** Every Upkeep, the one due soonest first: create, rename, change the interval or stop. */
export function UpkeepsDrawer({
  upkeeps,
  today,
  focusId,
  onClose,
}: {
  upkeeps: UpkeepView[];
  today: IsoDate;
  focusId: string | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [adding, setAdding] = useState(upkeeps.length === 0);

  useEffect(() => {
    dialog.current?.showModal();
    // showModal focuses the first button; with no Upkeeps yet, the title is what to type.
    dialog.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-label="Upkeeps"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[480px] translate-x-0 border-l border-line bg-surface p-0 text-foreground transition-transform duration-200 ease-out backdrop:bg-black/40 starting:translate-x-full motion-reduce:transition-none"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Upkeeps</h2>
            <div className="text-xs text-muted">Recurring responsibilities. Not strategy, but not to forget.</div>
          </div>
          {!adding && <AddIconButton label="Add Upkeep" onClick={() => setAdding(true)} />}
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            title="Close"
            className="text-lg leading-none text-muted hover:text-foreground"
          >
            ×
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {adding && <NewUpkeep today={today} onDone={() => setAdding(false)} />}
          {upkeeps.length === 0 && !adding && <p className="text-sm text-muted">No Upkeeps yet.</p>}
          <ul className="flex flex-col gap-2">
            {upkeeps.map((upkeep) => (
              <UpkeepRow key={upkeep.id} upkeep={upkeep} today={today} focused={upkeep.id === focusId} />
            ))}
          </ul>
        </div>
      </div>
    </dialog>
  );
}

function NewUpkeep({ today, onDone }: { today: IsoDate; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-line p-3"
      action={(fd) =>
        startTransition(async () => {
          await createUpkeep(fd);
          onDone();
        })
      }
    >
      <input
        name="title"
        required
        autoFocus
        data-autofocus
        placeholder="Change the motorcycle's oil"
        className="input"
        onKeyDown={(event) => event.key === "Escape" && (event.preventDefault(), onDone())}
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          First on
          <input name="day" type="date" required defaultValue={today} className="input" />
        </label>
        <label className="flex items-center gap-1.5">
          every
          <input
            name="intervalDays"
            type="number"
            min={1}
            max={MAX_INTERVAL_DAYS}
            required
            defaultValue={DEFAULT_INTERVAL_DAYS}
            className="input w-20 tabular-nums"
          />
          days
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="text-sm text-muted hover:underline" onClick={onDone}>
          Cancel
        </button>
        <button className="btn disabled:opacity-50" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}

function UpkeepRow({ upkeep, today, focused }: { upkeep: UpkeepView; today: IsoDate; focused: boolean }) {
  const row = useRef<HTMLLIElement>(null);
  const [editing, setEditing] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [title, setTitle] = useState(upkeep.title);
  const [days, setDays] = useState(String(upkeep.intervalDays));
  const [pending, startTransition] = useTransition();
  const dirty = title.trim() !== upkeep.title || Number(days) !== upkeep.intervalDays;

  useEffect(() => {
    if (focused) row.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  function cancelEdit() {
    setTitle(upkeep.title);
    setDays(String(upkeep.intervalDays));
    setEditing(false);
  }

  return (
    <li
      ref={row}
      className={`flex flex-col gap-1.5 rounded-md border p-2.5 text-sm ${focused ? "border-accent" : "border-line"}`}
    >
      {editing ? (
        <form
          className="flex flex-col gap-2"
          action={(fd) =>
            startTransition(async () => {
              await updateUpkeep(fd);
              setEditing(false);
            })
          }
          onKeyDown={(event) => event.key === "Escape" && (event.preventDefault(), cancelEdit())}
        >
          <Hidden id={upkeep.id} />
          <input name="title" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
          <label className="flex items-center gap-1.5">
            every
            <input
              name="intervalDays"
              type="number"
              min={1}
              max={MAX_INTERVAL_DAYS}
              required
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="input w-20 tabular-nums"
            />
            days
          </label>
          <p className="text-xs text-muted">The pending one keeps its day; drag it in the Month to move it.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="text-sm text-muted hover:underline" onClick={cancelEdit}>
              Cancel
            </button>
            {dirty && (
              <button className="btn disabled:opacity-50" disabled={pending || !title.trim()}>
                {pending ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium">{upkeep.title}</div>
            <div className="text-xs text-muted">{intervalLabel(upkeep.intervalDays)}</div>
          </div>
          <button
            type="button"
            className="text-muted hover:text-foreground"
            title="Rename or change the interval"
            aria-label={`Edit ${upkeep.title}`}
            onClick={() => setEditing(true)}
          >
            ✎
          </button>
          <button
            type="button"
            className="text-muted hover:text-red-600"
            title="Stop this Upkeep"
            aria-label={`Stop ${upkeep.title}`}
            onClick={() => setStopping(true)}
          >
            ×
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 text-xs">
        <span>
          Next:{" "}
          {upkeep.next ? (
            <Link className="hover:underline" href={`/os/day/${upkeep.next.day}`}>
              {shortDate(upkeep.next.day, today)}
              {upkeep.next.day < today ? " (carried over)" : ""}
            </Link>
          ) : (
            "—"
          )}
        </span>
        <span className="text-muted">Last: {upkeep.lastDone ? shortDate(upkeep.lastDone, today) : "never"}</span>
      </div>
      {stopping && <StopUpkeep id={upkeep.id} title={upkeep.title} onCancel={() => setStopping(false)} />}
    </li>
  );
}

/** Asked twice: stopping removes its pending occurrence. */
export function StopUpkeep({ id, title, onCancel }: { id: string; title: string; onCancel: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <div role="alertdialog" aria-label={`Stop ${title}?`} className="flex flex-col gap-2 rounded-md border border-line bg-background p-2.5">
      <p className="text-sm">
        Stop <span className="font-medium">{title}</span>?
      </p>
      <p className="text-xs text-muted">Its pending one goes away. The ones already done stay as they are.</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onCancel} autoFocus>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary disabled:opacity-50"
          disabled={pending}
          onClick={() => startTransition(() => stopUpkeep({ id }))}
        >
          {pending ? "Stopping…" : "Stop"}
        </button>
      </div>
    </div>
  );
}
