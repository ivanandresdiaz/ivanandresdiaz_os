"use client";

import { useState, useTransition } from "react";
import { listReadyClips, moveClipToPrinciple } from "@/server/clip-actions";
import type { ClipView } from "@/server/clips";

/** Add Reference → From Clips: a Clip with its file leaves the bank and becomes a Reference here. */
export function ClipPicker({ principleId }: { principleId: string }) {
  const [clips, setClips] = useState<ClipView[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);

  function load() {
    setOpen(true);
    setError(null);
    startTransition(async () => {
      try {
        setClips(await listReadyClips());
      } catch {
        setError("Couldn't load the Clips.");
      }
    });
  }

  function take(clip: ClipView) {
    setMovingId(clip.id);
    setError(null);
    startTransition(async () => {
      try {
        await moveClipToPrinciple({ clipId: clip.id, principleId });
        setClips((all) => all?.filter((c) => c.id !== clip.id) ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't move it.");
      } finally {
        setMovingId(null);
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={load} className="self-start text-sm text-accent hover:underline">
        From Clips
      </button>
    );
  }

  return (
    <section aria-label="From Clips" className="flex flex-col gap-2 rounded-lg border border-line p-3">
      <div className="flex items-center justify-between">
        <span className="label">From Clips</span>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-foreground">
          Done
        </button>
      </div>
      {clips === null ? (
        <p className="text-sm text-muted">{error ?? "Loading…"}</p>
      ) : clips.length === 0 ? (
        <p className="text-sm text-muted">No Clips with their file. Reels you save in Profile → Clips show up here.</p>
      ) : (
        <ul className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
          {clips.map((clip) => (
            <li key={clip.id} className="flex w-24 shrink-0 flex-col gap-1">
              {clip.videoUrl && (
                <video
                  src={`${clip.videoUrl}#t=0.1`}
                  muted
                  playsInline
                  preload="metadata"
                  className="aspect-[9/16] w-24 rounded-lg bg-line object-cover"
                />
              )}
              <p className="line-clamp-2 text-xs break-words" title={clip.title}>
                {clip.title}
              </p>
              <button
                type="button"
                className="btn py-0.5 text-xs"
                disabled={pending}
                onClick={() => take(clip)}
                aria-label={`Add ${clip.title} as a Reference`}
              >
                {movingId === clip.id ? "Adding…" : "Add"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {clips !== null && error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-muted">Adding moves it: it leaves Clips, with no copy.</p>
    </section>
  );
}
