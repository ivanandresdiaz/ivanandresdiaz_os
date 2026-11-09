"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  clock,
  normalizeTrim,
  parseClock,
  removedLabel,
  TRIM_PROBLEM_TEXT,
  trimProblem,
  type TrimKind,
  type TrimRange,
} from "@/domain/trims";
import { dismissTrim, retryTrim } from "@/server/trim-actions";
import type { TrimAnswer, TrimView } from "@/server/trims";
import { keepEvents } from "./confirm-delete";

/** How often the page looks again while a Trim runs. */
const POLL_MS = 5000;

/**
 * ✂: opens the video or audio to mark where it starts and ends, then cuts the
 * file for good. Only in edit mode; disabled while a Trim already runs.
 */
export function TrimButton({
  url,
  kind,
  title,
  trim,
  onTrim,
  className = "text-muted hover:text-foreground disabled:opacity-40",
}: {
  url: string;
  kind: TrimKind;
  title: string;
  trim?: TrimView | null;
  onTrim: (range: TrimRange) => Promise<TrimAnswer>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        {...keepEvents}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        disabled={trim?.status === "trimming"}
        className={className}
        title="Trim"
        aria-label={`Trim ${title}`}
      >
        ✂
      </button>
      {open && <TrimDialog url={url} kind={kind} title={title} onTrim={onTrim} onClose={() => setOpen(false)} />}
    </>
  );
}

/** A typed mark: empty is no cut there, text that isn't a time is NaN (so it shows as a problem). */
const markOf = (text: string) => (text.trim() ? (parseClock(text) ?? Number.NaN) : null);

function TrimDialog({
  url,
  kind,
  title,
  onTrim,
  onClose,
}: {
  url: string;
  kind: TrimKind;
  title: string;
  onTrim: (range: TrimRange) => Promise<TrimAnswer>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const media = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const previewEnd = useRef<number | null>(null);

  const range = normalizeTrim({ startS: markOf(startText), endS: markOf(endText) }, duration);
  const problem = trimProblem(range, duration);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  function close() {
    media.current?.pause();
    dialog.current?.close();
  }

  function onTime() {
    const player = media.current;
    if (!player) return;
    setNow(player.currentTime);
    if (Number.isFinite(player.duration)) setDuration(player.duration);
    // A preview stops where the cut ends.
    if (previewEnd.current !== null && player.currentTime >= previewEnd.current) {
      player.pause();
      previewEnd.current = null;
    }
  }

  function preview() {
    const player = media.current;
    if (!player) return;
    player.currentTime = range.startS ?? 0;
    previewEnd.current = range.endS;
    player.play().catch(() => {});
  }

  function trim() {
    startTransition(async () => {
      const answer = await onTrim(range);
      if (answer.ok) close();
      else {
        setMessage(answer.message);
        setConfirming(false);
      }
    });
  }

  const here = () => clock(media.current?.currentTime ?? now);
  const shown = (seconds: number | null, fallback: string) => (seconds === null ? fallback : clock(seconds));

  return (
    <div className="contents" {...keepEvents}>
      <dialog
        ref={dialog}
        aria-label={`Trim ${title}`}
        onClose={onClose}
        onClick={(event) => event.target === event.currentTarget && close()}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-3 p-4 text-sm">
          <h2 className="font-semibold">
            Trim <span className="break-words">“{title}”</span>
          </h2>
          {kind === "video" ? (
            <video
              ref={media}
              src={url}
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={onTime}
              onLoadedMetadata={onTime}
              onSeeked={onTime}
              className="max-h-[45vh] w-full rounded bg-black object-contain"
            />
          ) : (
            <audio
              ref={media}
              src={url}
              controls
              preload="metadata"
              onTimeUpdate={onTime}
              onLoadedMetadata={onTime}
              onSeeked={onTime}
              className="w-full"
            />
          )}

          {confirming ? (
            <>
              <p>{removedLabel(range, duration)}</p>
              <p className="text-xs text-muted">The trimmed file replaces this one. This can&apos;t be undone.</p>
              <div className="flex items-center justify-end gap-2">
                <button type="button" className="btn" onClick={() => setConfirming(false)}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn border-red-600 bg-red-600 text-white hover:bg-red-700"
                  disabled={pending}
                  onClick={trim}
                >
                  {pending ? "Starting…" : "Trim"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted tabular-nums">
                At {clock(now)}
                {duration !== null && ` of ${clock(duration)}`}
              </p>
              <Mark
                label="Start"
                here="Start here"
                value={startText}
                placeholder="0:00"
                onHere={() => setStartText(here())}
                onChange={setStartText}
              />
              <Mark
                label="End"
                here="End here"
                value={endText}
                placeholder={duration !== null ? clock(duration) : "end"}
                onHere={() => setEndText(here())}
                onChange={setEndText}
              />
              <p aria-live="polite" className={`text-xs ${message ? "text-red-600" : "text-muted"}`}>
                {message ??
                  (problem
                    ? TRIM_PROBLEM_TEXT[problem]
                    : `Keeps ${shown(range.startS, "0:00")}–${shown(range.endS, duration !== null ? clock(duration) : "the end")}.`)}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button type="button" className="btn mr-auto" disabled={problem !== null} onClick={preview}>
                  ▶ Preview
                </button>
                <button type="button" className="btn" onClick={close}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary disabled:opacity-50"
                  disabled={problem !== null}
                  onClick={() => {
                    media.current?.pause();
                    setMessage(null);
                    setConfirming(true);
                  }}
                >
                  Trim…
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}

function Mark({
  label,
  here,
  value,
  placeholder,
  onHere,
  onChange,
}: {
  label: string;
  here: string;
  value: string;
  placeholder: string;
  onHere: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn w-28 shrink-0 text-sm" onClick={onHere}>
        {here}
      </button>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        placeholder={placeholder}
        className="input w-24 py-1 text-sm tabular-nums"
      />
      {value && (
        <button
          type="button"
          className="text-muted hover:text-foreground"
          onClick={() => onChange("")}
          aria-label={`Clear ${label.toLowerCase()}`}
          title={`No cut at the ${label.toLowerCase()}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

/** "Trimming…" while a Trim runs (looking again until it lands), or why it failed, with Retry. */
export function TrimState({ trim, className = "text-xs" }: { trim?: TrimView | null; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const trimming = trim?.status === "trimming";

  // Nothing tells the page a Trim ended, so it looks again until the new file is in.
  useEffect(() => {
    if (!trimming) return;
    const timer = window.setInterval(() => router.refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [trimming, router]);

  if (!trim) return null;
  if (trimming) return <p className={`${className} text-muted`}>✂ Trimming…</p>;
  return (
    <p className={`${className} flex flex-wrap items-center gap-x-2 text-red-600`}>
      <span>{trim.error ?? "Couldn't trim."}</span>
      <button
        type="button"
        className="text-accent hover:underline disabled:opacity-50"
        disabled={pending}
        onClick={() => startTransition(() => retryTrim({ id: trim.id }))}
      >
        Retry
      </button>
      <button
        type="button"
        className="text-muted hover:text-foreground"
        disabled={pending}
        aria-label="Keep it whole"
        title="Keep it whole"
        onClick={() => startTransition(() => dismissTrim({ id: trim.id }))}
      >
        ×
      </button>
    </p>
  );
}
