"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AUDIO_SKIP_SECONDS, formatClock, IMAGE_STORY_MS, skipTo } from "@/domain/references";
import type { ReferenceView } from "@/server/queries";
import { UNTITLED_AUDIO } from "./references";

const HOLD_MS = 200;
const SWIPE_PX = 50;

type Direction = -1 | 1;

/** Full-screen, story-style playback of a Principle's References. */
export function StoryViewer({
  principleTitle,
  references,
  startIndex,
  onClose,
}: {
  /** Shown as a quiet caption so Ivan knows which Principle these References carry. */
  principleTitle: string;
  references: ReferenceView[];
  startIndex: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const media = useRef<HTMLMediaElement | null>(null);
  const elapsed = useRef(0);
  const press = useRef<{ x: number; held: boolean; timer: number; wasPaused: boolean } | null>(null);
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [confirming, setConfirming] = useState<Direction | null>(null);
  const current = references[index];
  const timed = current?.kind === "image" || failed;
  const listening = current?.kind === "audio" && !failed;

  const attachMedia = useCallback((el: HTMLMediaElement | null) => {
    media.current = el;
  }, []);

  useEffect(() => {
    dialog.current?.showModal();
    // Arrow keys navigate, so focus must not start on the audio scrubber.
    dialog.current?.focus();
  }, []);

  const go = useCallback(
    (next: number) => {
      if (next >= references.length) return onClose();
      const target = Math.max(0, next);
      if (target === index && media.current) media.current.currentTime = 0;
      elapsed.current = 0;
      setIndex(target);
      setProgress(0);
      setTime(0);
      setDuration(0);
      setFailed(false);
      setPaused(false);
      setConfirming(null);
    },
    [references.length, index, onClose],
  );

  useEffect(() => {
    if (!timed || paused) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      elapsed.current += now - last;
      last = now;
      if (elapsed.current >= IMAGE_STORY_MS) return go(index + 1);
      setProgress(elapsed.current / IMAGE_STORY_MS);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [timed, paused, index, go]);

  useEffect(() => {
    const el = media.current;
    if (!el || failed) return;
    if (paused) return el.pause();
    el.play().catch(() => {
      // Autoplay with sound can be refused; fall back to muted playback.
      el.muted = true;
      setMuted(true);
      el.play().catch(() => {});
    });
  }, [paused, index, failed]);

  if (!current) return null;

  function onTime(event: React.SyntheticEvent<HTMLMediaElement>) {
    const { currentTime, duration } = event.currentTarget;
    setTime(currentTime);
    if (Number.isFinite(duration)) setDuration(duration);
    if (duration) setProgress(currentTime / duration);
  }

  function seek(to: number) {
    const el = media.current;
    if (!el) return;
    el.currentTime = to;
    setTime(to);
  }

  function keepListening() {
    setConfirming(null);
    setPaused(false);
  }

  function onPointerDown(event: React.PointerEvent) {
    const wasPaused = paused;
    const timer = window.setTimeout(() => {
      if (press.current) press.current.held = true;
      setPaused(true);
    }, HOLD_MS);
    press.current = { x: event.clientX, held: false, timer, wasPaused };
  }

  function onPointerUp(event: React.PointerEvent<HTMLElement>) {
    const start = press.current;
    press.current = null;
    if (!start) return;
    window.clearTimeout(start.timer);
    if (start.held) return setPaused(start.wasPaused);
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > SWIPE_PX) return go(dx < 0 ? index + 1 : index - 1);
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - left) / width;
    if (listening) {
      // A stray tap must not lose the place in a long audio, so moving asks first.
      if (x < 1 / 3 || x > 2 / 3) {
        setPaused(true);
        setConfirming(x < 1 / 3 ? -1 : 1);
      } else {
        setPaused((p) => !p);
      }
      return;
    }
    if (x < 1 / 3) go(index - 1);
    else if (x > 2 / 3) go(index + 1);
    else setPaused((p) => !p);
  }

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      aria-label="References"
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement) return;
        if (event.key === "ArrowRight") go(index + 1);
        else if (event.key === "ArrowLeft") go(index - 1);
        else if (event.key === " ") {
          event.preventDefault();
          if (confirming !== null) keepListening();
          else setPaused((p) => !p);
        }
      }}
      className="fixed inset-0 m-0 h-auto max-h-none w-auto max-w-none overflow-hidden bg-black p-0 text-white outline-none backdrop:bg-black"
    >
      <div className="relative flex h-full w-full items-center justify-center select-none">
        <div
          className={`absolute inset-0 flex items-center justify-center ${
            listening ? "bg-gradient-to-b from-neutral-800 via-neutral-900 to-black" : ""
          }`}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            const start = press.current;
            press.current = null;
            if (!start) return;
            window.clearTimeout(start.timer);
            setPaused(start.wasPaused);
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {failed ? (
            <p className="max-w-xs px-6 text-center text-sm text-white/80">
              {current.kind === "audio"
                ? "This audio can’t play in this browser. MP3 plays everywhere."
                : "This video can’t play in this browser. MP4 (H.264) plays everywhere."}
            </p>
          ) : current.kind === "audio" ? (
            <div className="pointer-events-none flex max-w-sm flex-col items-center gap-4 px-6 text-center">
              <audio
                key={current.id}
                ref={attachMedia}
                src={current.url}
                preload="auto"
                muted={muted}
                onLoadedMetadata={onTime}
                onTimeUpdate={onTime}
                onEnded={() => go(index + 1)}
                onError={() => setFailed(true)}
              />
              <span aria-hidden className="text-8xl">
                🎧
              </span>
              <p className="line-clamp-3 text-lg font-medium break-words">{current.title || UNTITLED_AUDIO}</p>
              <p className="text-sm text-white/70 tabular-nums">
                {formatClock(time)} / {formatClock(duration)}
              </p>
            </div>
          ) : current.kind === "video" ? (
            <video
              key={current.id}
              ref={attachMedia}
              src={current.url}
              playsInline
              muted={muted}
              onTimeUpdate={onTime}
              onEnded={() => go(index + 1)}
              onError={() => setFailed(true)}
              className="pointer-events-none max-h-full max-w-full object-contain"
            />
          ) : (
            // Signed R2 links expire, so they bypass the Next.js image optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={current.id}
              src={current.url}
              alt=""
              draggable={false}
              className="pointer-events-none max-h-full max-w-full object-contain"
            />
          )}
          {paused && !listening && (
            <span
              aria-hidden
              className="pointer-events-none absolute flex size-20 items-center justify-center rounded-full bg-black/40 pl-1 text-4xl text-white/90"
            >
              ▶
            </span>
          )}
        </div>

        {!listening && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-4 pt-10 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <PrincipleCaption title={principleTitle} />
          </div>
        )}

        {listening && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 bg-gradient-to-t from-black/60 to-transparent px-6 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <PrincipleCaption title={principleTitle} />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step="any"
              value={Math.min(time, duration || 0)}
              onChange={(event) => seek(Number(event.target.value))}
              aria-label="Position"
              className="w-full accent-white"
            />
            <div className="flex items-center justify-center gap-10 text-sm">
              <button
                type="button"
                onClick={() => seek(skipTo(time, -AUDIO_SKIP_SECONDS, duration))}
                aria-label={`Back ${AUDIO_SKIP_SECONDS} seconds`}
              >
                −{AUDIO_SKIP_SECONDS}s
              </button>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "Play" : "Pause"}
                className="flex size-12 items-center justify-center rounded-full bg-white text-lg text-black"
              >
                {paused ? "▶" : "❚❚"}
              </button>
              <button
                type="button"
                onClick={() => seek(skipTo(time, AUDIO_SKIP_SECONDS, duration))}
                aria-label={`Forward ${AUDIO_SKIP_SECONDS} seconds`}
              >
                +{AUDIO_SKIP_SECONDS}s
              </button>
            </div>
          </div>
        )}

        {confirming !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50" onClick={keepListening}>
            <div
              role="alertdialog"
              aria-label="Leave this audio?"
              onClick={(event) => event.stopPropagation()}
              className="flex flex-col items-center gap-4 rounded-xl bg-neutral-900 px-6 py-5 shadow-lg"
            >
              <p className="font-medium">{confirmQuestion(confirming, index, references.length)}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={keepListening}
                  className="rounded-md border border-white/30 px-3 py-1.5 text-sm"
                >
                  Keep listening
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => go(index + confirming)}
                  className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black"
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 bg-gradient-to-b from-black/60 to-transparent px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div className="flex gap-1">
            {references.map((r, i) => (
              <div key={r.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full bg-white"
                  style={{ width: `${i < index ? 100 : i === index ? progress * 100 : 0}%` }}
                />
              </div>
            ))}
          </div>
          <div className="pointer-events-auto flex items-center justify-end gap-4 text-lg leading-none">
            {paused && <span className="mr-auto text-xs text-white/70">Paused</span>}
            {current.kind !== "image" && !failed && (
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Unmute" : "Mute"}
                title={muted ? "Unmute" : "Mute"}
                className="text-sm"
              >
                {muted ? "🔇" : "🔊"}
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" title="Close">
              ×
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

function PrincipleCaption({ title }: { title: string }) {
  return (
    <p className="pointer-events-none line-clamp-2 max-w-[70%] text-sm font-medium break-words text-white/80 drop-shadow">
      {title}
    </p>
  );
}

function confirmQuestion(direction: Direction, index: number, count: number) {
  if (direction === -1) return index === 0 ? "Start over?" : "Previous Reference?";
  return index === count - 1 ? "Close References?" : "Next Reference?";
}
