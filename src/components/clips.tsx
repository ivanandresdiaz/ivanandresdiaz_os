"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { canDownload, MAX_CLIP_TITLE, type ClipSource } from "@/domain/clips";
import { formatClock } from "@/domain/references";
import { addClip, deleteClip, downloadClip, moveClipToPrinciple, renameClip } from "@/server/clip-actions";
import type { ClipView } from "@/server/clips";
import { ConfirmDelete } from "./confirm-delete";

/** How often Clips look again while something downloads. */
const POLL_MS = 5000;

type Filter = "all" | ClipSource;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
];

export function Clips({ clips, principles }: { clips: ClipView[]; principles: { id: string; title: string }[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const downloading = clips.some((clip) => clip.status === "downloading");
  const shown = filter === "all" ? clips : clips.filter((clip) => clip.source === filter);

  useEffect(() => {
    if (!downloading) return;
    const timer = window.setInterval(() => router.refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [downloading, router]);

  return (
    <div className="flex flex-col gap-4">
      <AddClip />
      {clips.length > 0 && (
        <div role="group" aria-label="Show" className="flex self-start rounded-md border border-line p-0.5 text-sm">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded px-2 py-0.5 ${filter === f.value ? "bg-line text-foreground" : "text-muted hover:text-foreground"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
      {clips.length === 0 ? (
        <p className="text-sm text-muted">Nothing waiting. Paste a link from Instagram or YouTube.</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">No Clips from {filter === "instagram" ? "Instagram" : "YouTube"}.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((clip) => (
            <ClipRow key={clip.id} clip={clip} principles={principles} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddClip() {
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!link.trim()) return;
        startTransition(async () => {
          const result = await addClip({ link });
          if (result.ok) {
            setLink("");
            setMessage(null);
          } else setMessage(result.message);
        });
      }}
    >
      <div className="flex gap-2">
        <input
          value={link}
          onChange={(event) => {
            setLink(event.target.value);
            setMessage(null);
          }}
          inputMode="url"
          autoComplete="off"
          aria-label="Link"
          placeholder="Paste a reel or YouTube link"
          className="input min-w-0 flex-1"
        />
        <button className="btn-primary disabled:opacity-50" disabled={pending || !link.trim()}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p aria-live="polite" className={`text-xs ${message ? "text-red-600" : "text-muted"}`}>
        {message ?? "Reels download by themselves. YouTube videos stay a link, for now."}
      </p>
    </form>
  );
}

function ClipRow({ clip, principles }: { clip: ClipView; principles: { id: string; title: string }[] }) {
  const [renaming, setRenaming] = useState(false);
  const [moving, setMoving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const facts = [
    clip.source === "instagram" ? "Instagram" : "YouTube",
    clip.durationS ? formatClock(clip.durationS) : null,
  ].filter(Boolean);

  return (
    <li className="card flex gap-3">
      <Thumbnail clip={clip} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {renaming ? (
          <TitleForm
            title={clip.title}
            onCancel={() => setRenaming(false)}
            onSave={(title) => {
              setRenaming(false);
              run(() => renameClip({ id: clip.id, title }));
            }}
          />
        ) : (
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-sm font-medium break-words">{clip.title}</p>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              title="Rename"
              aria-label={`Rename ${clip.title}`}
              className="text-muted hover:text-foreground"
            >
              ✎
            </button>
            <ConfirmDelete action={deleteClip} id={clip.id} what="Clip" title={clip.title} />
          </div>
        )}
        <p className="text-xs text-muted">
          {facts.join(" · ")}
          {clip.status === "link" && " · Link only"}
        </p>
        <Status clip={clip} pending={pending} onDownload={() => run(() => downloadClip({ id: clip.id }))} />
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <a href={clip.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            Open original ↗
          </a>
          {clip.status === "ready" && !moving && principles.length > 0 && (
            <button type="button" className="text-accent hover:underline" onClick={() => setMoving(true)}>
              Move to a Principle
            </button>
          )}
        </div>
        {moving && (
          <MoveForm
            principles={principles}
            pending={pending}
            onCancel={() => setMoving(false)}
            onMove={(principleId) => run(() => moveClipToPrinciple({ clipId: clip.id, principleId }))}
          />
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </li>
  );
}

function Status({ clip, pending, onDownload }: { clip: ClipView; pending: boolean; onDownload: () => void }) {
  if (clip.status === "downloading") {
    return <p className="animate-pulse text-xs text-muted motion-reduce:animate-none">Downloading…</p>;
  }
  if (clip.status === "failed") {
    return (
      <p className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-red-600">{clip.error ?? "Couldn't download."}</span>
        <button type="button" className="btn py-0.5 text-xs" disabled={pending} onClick={onDownload}>
          {pending ? "Retrying…" : "Retry"}
        </button>
      </p>
    );
  }
  if (clip.status === "link") {
    if (!clip.error && !canDownload(clip.source)) return null;
    return (
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {clip.error && <span>{clip.error}</span>}
        {canDownload(clip.source) && !clip.error && (
          <button type="button" className="btn py-0.5 text-xs" disabled={pending} onClick={onDownload}>
            Download
          </button>
        )}
      </p>
    );
  }
  return null;
}

function Thumbnail({ clip }: { clip: ClipView }) {
  if (clip.videoUrl) {
    return (
      <a href={clip.videoUrl} target="_blank" rel="noreferrer" className="block shrink-0" aria-label="Play the file">
        <video
          src={`${clip.videoUrl}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          className="aspect-[9/16] w-16 rounded-md bg-line object-cover"
        />
      </a>
    );
  }
  if (clip.thumbnail) {
    return (
      // A public still from YouTube; not worth the image optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={clip.thumbnail}
        alt=""
        loading="lazy"
        className="aspect-video w-28 shrink-0 rounded-md bg-line object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-[9/16] w-16 shrink-0 items-center justify-center rounded-md bg-line text-xs text-muted">
      {clip.source === "instagram" ? "Reel" : "Video"}
    </div>
  );
}

function TitleForm({
  title,
  onSave,
  onCancel,
}: {
  title: string;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(title);
  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim() && value.trim() !== title) onSave(value.trim());
        else onCancel();
      }}
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && onCancel()}
        maxLength={MAX_CLIP_TITLE}
        autoFocus
        aria-label="Title"
        className="input min-w-0 flex-1 py-1 text-sm"
      />
      <button className="btn text-sm" disabled={!value.trim()}>
        Save
      </button>
    </form>
  );
}

function MoveForm({
  principles,
  pending,
  onMove,
  onCancel,
}: {
  principles: { id: string; title: string }[];
  pending: boolean;
  onMove: (principleId: string) => void;
  onCancel: () => void;
}) {
  const [principleId, setPrincipleId] = useState("");
  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-line p-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (principleId) onMove(principleId);
      }}
    >
      <p className="text-xs text-muted">It leaves Clips and becomes a Reference on:</p>
      <select
        value={principleId}
        onChange={(event) => setPrincipleId(event.target.value)}
        aria-label="Principle"
        className="input text-sm"
      >
        <option value="">Choose a Principle</option>
        {principles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button className="btn-primary text-sm disabled:opacity-50" disabled={!principleId || pending}>
          {pending ? "Moving…" : "Move"}
        </button>
        <button type="button" className="btn text-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
