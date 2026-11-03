"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatMinutes } from "@/domain/dates";
import { DEFAULT_REMINDER_LEAD, leadLabel, REMINDER_LEADS } from "@/domain/reminders";
import { retryReminders, setSlotReminder } from "@/server/actions";
import type { SlotReminder } from "@/server/queries";

export function BellIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`inline-block size-3 ${className}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/** The "!" of a bell whose last change did not reach Google: never look like it will remind when it may not. */
function Failed() {
  return <span className="text-[10px] font-bold text-red-600 dark:text-red-400">!</span>;
}

/** The small bell beside a title in the Check-in and the Month: it only says the Slot reminds. No color. */
export function ReminderMark({ failed }: { failed: boolean }) {
  return (
    <span
      className="ml-1 inline-flex items-center text-muted"
      title={failed ? "Reminder: Google Calendar may be out of date. Open it in the calendar." : "Reminder on"}
      aria-label={failed ? "Reminder failed" : "Reminder on"}
    >
      <BellIcon />
      {failed && <Failed />}
    </span>
  );
}

const keep = {
  onPointerDown: (event: React.SyntheticEvent) => event.stopPropagation(),
  onClick: (event: React.SyntheticEvent) => event.stopPropagation(),
  onKeyDown: (event: React.SyntheticEvent) => event.stopPropagation(),
};

/**
 * A Slot's bell in the calendar. Off, it shows on hover (always on a touch
 * screen) until the Slot starts; on, it stays. Tapping an off bell turns it on,
 * 10 min before, and opens the menu to change that.
 */
export function ReminderBell({
  slot,
  title,
  done,
  started,
  connected,
}: {
  slot: { id: string; startMin: number; reminder: SlotReminder };
  title: string;
  done: boolean;
  started: boolean;
  connected: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { leadMin, failed } = slot.reminder;
  const on = leadMin !== null && !done;
  if (!failed && !on && (done || started)) return null;

  return (
    <>
      <button
        type="button"
        {...keep}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={`items-center gap-px leading-none ${
          on || failed
            ? "inline-flex text-muted hover:text-foreground"
            : "hidden text-muted/60 group-hover:inline-flex hover:text-foreground pointer-coarse:inline-flex"
        }`}
        title={failed ? "Reminder: could not reach Google Calendar" : on ? `Reminder: ${leadLabel(leadMin)}` : "Remind me"}
        aria-label={failed ? `Reminder of ${title} failed` : on ? `Reminder of ${title}: ${leadLabel(leadMin)}` : `Remind me of ${title}`}
      >
        <BellIcon className={on ? "fill-current" : ""} />
        {failed && <Failed />}
      </button>
      {open && (
        <div className="contents" {...keep}>
          <ReminderMenu
            slot={slot}
            title={title}
            done={done}
            started={started}
            connected={connected}
            turnOn={!on && !failed && connected}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}

function ReminderMenu({
  slot,
  title,
  done,
  started,
  connected,
  turnOn,
  onClose,
}: {
  slot: { id: string; startMin: number; reminder: SlotReminder };
  title: string;
  done: boolean;
  started: boolean;
  connected: boolean;
  /** Opened from an off bell: it turns on at once. */
  turnOn: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [needsConnect, setNeedsConnect] = useState(!connected && slot.reminder.leadMin === null);
  const [note, setNote] = useState<string | null>(null);
  const { failed } = slot.reminder;
  const [leadMin, setLeadMin] = useState<number | null>(turnOn ? DEFAULT_REMINDER_LEAD : slot.reminder.leadMin);
  const back = encodeURIComponent(pathname);
  const connectHref = (withSlot: boolean) =>
    `/api/google-calendar/connect?back=${back}${withSlot ? `&slot=${slot.id}` : ""}`;

  function refused(error: "connect" | "started", before: number | null) {
    setLeadMin(before);
    if (error === "connect") setNeedsConnect(true);
    else setNote("This Slot already started: there is nothing left to remind.");
  }

  function choose(lead: number | null) {
    const before = leadMin;
    setLeadMin(lead);
    startTransition(async () => {
      const result = await setSlotReminder({ id: slot.id, leadMin: lead });
      if (result.ok) dialog.current?.close();
      else refused(result.error, before);
    });
  }

  const turnedOn = useRef(false);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    // Opened from an off bell: it is already shown at 10; the menu stays open to change it.
    if (turnOn && !turnedOn.current) {
      turnedOn.current = true;
      void setSlotReminder({ id: slot.id, leadMin: DEFAULT_REMINDER_LEAD }).then((result) => {
        if (!result.ok) refused(result.error, null);
      });
    }
    // Once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A started Slot (or done work) only lets its bell be turned off.
  const options: (number | null)[] = started || done ? [null] : [null, ...REMINDER_LEADS];

  return (
    <dialog
      ref={dialog}
      aria-label={`Reminder of ${title}`}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
      className="m-auto w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-3 p-4 text-sm">
        <h2 className="flex items-center gap-1.5 font-semibold">
          <BellIcon className="size-3.5" />
          <span className="truncate">{title}</span>
          <span className="font-normal text-muted tabular-nums">{formatMinutes(slot.startMin)}</span>
        </h2>

        {failed && (
          <div className="flex flex-col gap-2 rounded-md border border-red-500/40 p-2 text-xs">
            <p>Could not reach Google Calendar: what it shows for this Slot may be out of date.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await retryReminders();
                    dialog.current?.close();
                  })
                }
              >
                Try again
              </button>
              <a className="btn" href={connectHref(false)}>
                Reconnect Google Calendar
              </a>
            </div>
          </div>
        )}

        {needsConnect ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted">
              Reminders arrive through Google Calendar, in a calendar called &ldquo;Ivan OS&rdquo;. Connect it once
              and this bell turns on, 10 min before.
            </p>
            <a className="btn self-start" href={connectHref(true)}>
              Connect Google Calendar
            </a>
          </div>
        ) : (
          <div className="flex flex-col" role="menu">
            {options.map((lead) => {
              const current = lead === leadMin;
              return (
                <button
                  key={lead ?? "off"}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  disabled={pending}
                  onClick={() => (current ? dialog.current?.close() : choose(lead))}
                  className={`flex items-center justify-between rounded px-2 py-1.5 text-left hover:bg-background ${
                    current ? "font-medium" : "text-muted"
                  }`}
                >
                  {lead === null ? "Off" : leadLabel(lead)}
                  {current && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        )}
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
    </dialog>
  );
}
