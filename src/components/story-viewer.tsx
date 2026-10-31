"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IMAGE_STORY_MS } from "@/domain/references";
import type { ReferenceView } from "@/server/queries";

const HOLD_MS = 200;
const SWIPE_PX = 50;

/** Full-screen, story-style playback of a Principle's References. */
export function StoryViewer({
  references,
  startIndex,
  onClose,
}: {
  references: ReferenceView[];
  startIndex: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const elapsed = useRef(0);
  const press = useRef<{ x: number; held: boolean; timer: number } | null>(null);
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);
  const current = references[index];
  const timed = current?.kind === "image" || failed;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const go = useCallback(
    (next: number) => {
      if (next >= references.length) return onClose();
      elapsed.current = 0;
      setIndex(Math.max(0, next));
      setProgress(0);
      setFailed(false);
      setPaused(false);
    },
    [references.length, onClose],
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
    const el = video.current;
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

  function onPointerDown(event: React.PointerEvent) {
    const timer = window.setTimeout(() => {
      if (press.current) press.current.held = true;
      setPaused(true);
    }, HOLD_MS);
    press.current = { x: event.clientX, held: false, timer };
  }

  function onPointerUp(event: React.PointerEvent<HTMLElement>) {
    const start = press.current;
    press.current = null;
    if (!start) return;
    window.clearTimeout(start.timer);
    if (start.held) return setPaused(false);
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > SWIPE_PX) return go(dx < 0 ? index + 1 : index - 1);
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - left) / width;
    if (x < 1 / 3) go(index - 1);
    else if (x > 2 / 3) go(index + 1);
  }

  return (
    <dialog
      ref={dialog}
      aria-label="References"
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(index + 1);
        else if (event.key === "ArrowLeft") go(index - 1);
        else if (event.key === " ") {
          event.preventDefault();
          setPaused((p) => !p);
        }
      }}
      className="fixed inset-0 m-0 h-auto max-h-none w-auto max-w-none overflow-hidden bg-black p-0 text-white backdrop:bg-black"
    >
      <div className="relative flex h-full w-full items-center justify-center select-none">
        <div
          className="absolute inset-0 flex items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            if (press.current) window.clearTimeout(press.current.timer);
            press.current = null;
            setPaused(false);
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {failed ? (
            <p className="max-w-xs px-6 text-center text-sm text-white/80">
              This video can’t play in this browser. MP4 (H.264) plays everywhere.
            </p>
          ) : current.kind === "video" ? (
            <video
              key={current.id}
              ref={video}
              src={current.url}
              playsInline
              muted={muted}
              onTimeUpdate={(event) => {
                const { currentTime, duration } = event.currentTarget;
                if (duration) setProgress(currentTime / duration);
              }}
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
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 bg-gradient-to-b from-black/60 to-transparent p-3">
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
            {current.kind === "video" && !failed && (
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
