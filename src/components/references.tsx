"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import {
  ACCEPTED_REFERENCE_TYPES,
  MAX_REFERENCE_TITLE,
  moveItem,
  referenceContentType,
  TILE_PREVIEW_SECONDS,
  titleFromFileName,
  validateReferenceFile,
  type ReferenceFileProblem,
} from "@/domain/references";
import {
  confirmReferenceUpload,
  createReferenceUpload,
  deleteReference,
  renameReference,
  reorderReferences,
} from "@/server/actions";
import type { ReferenceView } from "@/server/queries";
import { trimReference } from "@/server/trim-actions";
import { TrimButton, TrimState } from "./trim";

const TILE_MIME = "application/x-ivan-reference";

export const UNTITLED_AUDIO = "Untitled audio";

const PROBLEM_TEXT: Record<ReferenceFileProblem, string> = {
  "unsupported-type": "Only JPG, PNG, WebP, GIF, MP4, WebM, MOV, MP3, M4A, AAC, OGG, Opus or WAV.",
  empty: "The file is empty.",
  "too-large": "Over 200 MB.",
};

export function ReferenceStrip({
  principleId,
  references,
  editing,
  onOpen,
}: {
  principleId: string;
  references: ReferenceView[];
  editing: boolean;
  onOpen: (index: number) => void;
}) {
  const [shown, setShown] = useOptimistic(references);
  const [, startTransition] = useTransition();
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  if (shown.length === 0) return null;

  function drop(draggedId: string, to: number) {
    setDragFrom(null);
    const from = shown.findIndex((r) => r.id === draggedId);
    if (from < 0 || from === to) return;
    const next = moveItem(shown, from, to);
    startTransition(async () => {
      setShown(next);
      await reorderReferences({ principleId, ids: next.map((r) => r.id) });
    });
  }

  function remove(id: string) {
    if (!window.confirm("Delete this Reference? The file is removed from storage too.")) return;
    startTransition(async () => {
      setShown(shown.filter((r) => r.id !== id));
      await deleteReference({ id });
    });
  }

  function rename(id: string, title: string) {
    startTransition(async () => {
      setShown(shown.map((r) => (r.id === id ? { ...r, title } : r)));
      await renameReference({ id, title });
    });
  }

  return (
    <div className="-mx-4 flex shrink-0 items-start gap-2 overflow-x-auto px-4 pb-1">
      {shown.map((reference, i) => (
        <div key={reference.id} className="flex w-24 shrink-0 flex-col gap-1">
          <div
            draggable={editing}
            onDragStart={(event) => {
              event.dataTransfer.setData(TILE_MIME, reference.id);
              event.dataTransfer.effectAllowed = "move";
              setDragFrom(i);
            }}
            onDragOver={(event) => {
              if (editing && event.dataTransfer.types.includes(TILE_MIME)) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              drop(event.dataTransfer.getData(TILE_MIME), i);
            }}
            onDragEnd={() => setDragFrom(null)}
            className={`relative aspect-[9/16] w-24 overflow-hidden rounded-lg bg-line ${
              editing ? "cursor-grab active:cursor-grabbing" : ""
            } ${dragFrom === i ? "opacity-40" : ""}`}
          >
            <button
              type="button"
              onClick={() => onOpen(i)}
              className="block h-full w-full"
              aria-label={`Open Reference ${i + 1} of ${shown.length}`}
            >
              {reference.kind === "video" ? (
                <VideoTile url={reference.url} />
              ) : reference.kind === "audio" ? (
                <AudioTile title={reference.title} />
              ) : (
                // Signed R2 links expire, so they bypass the Next.js image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={reference.url} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
              )}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => remove(reference.id)}
                title="Delete Reference"
                aria-label="Delete Reference"
                className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-red-600"
              >
                ×
              </button>
            )}
            {editing && reference.kind !== "image" && (
              <TrimButton
                url={reference.url}
                kind={reference.kind}
                title={reference.title || (reference.kind === "audio" ? UNTITLED_AUDIO : `Reference ${i + 1}`)}
                trim={reference.trim}
                onTrim={(range) => trimReference({ id: reference.id, ...range })}
                className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-accent disabled:opacity-40"
              />
            )}
          </div>
          <TrimState trim={reference.trim} className="text-[10px] leading-tight" />
          {editing && reference.kind === "audio" && (
            <TitleInput title={reference.title} onRename={(title) => rename(reference.id, title)} />
          )}
        </div>
      ))}
    </div>
  );
}

function AudioTile({ title }: { title: string }) {
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-neutral-700 to-neutral-950 p-2 text-white">
      <span aria-hidden className="text-3xl">
        🎧
      </span>
      <span className="line-clamp-4 text-center text-[11px] leading-tight break-words">{title || UNTITLED_AUDIO}</span>
    </span>
  );
}

/** Saves on blur; an emptied title goes back to the last saved one. */
function TitleInput({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [value, setValue] = useState(title);

  return (
    <input
      value={value}
      maxLength={MAX_REFERENCE_TITLE}
      aria-label="Audio title"
      placeholder={UNTITLED_AUDIO}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          event.preventDefault();
          setValue(title);
        }
      }}
      onBlur={() => {
        const next = value.trim();
        if (!next) return setValue(title);
        setValue(next);
        if (next !== title) onRename(next);
      }}
      className="w-full rounded border border-line bg-transparent px-1 py-0.5 text-[11px]"
    />
  );
}

/** Loops the first seconds, muted, only while the tile is on screen. */
function VideoTile({ url }: { url: string }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) el.play().catch(() => {});
      else el.pause();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={video}
      src={`${url}#t=0.001`}
      muted
      playsInline
      preload="metadata"
      onTimeUpdate={(event) => {
        if (event.currentTarget.currentTime >= TILE_PREVIEW_SECONDS) event.currentTarget.currentTime = 0;
      }}
      className="pointer-events-none h-full w-full object-cover"
    />
  );
}

type Upload = { id: string; name: string; progress: number; error: string | null };

export function ReferenceUploader({ principleId }: { principleId: string }) {
  return (
    <MediaUploader
      accept={ACCEPTED_REFERENCE_TYPES}
      label="Drop images, videos or audio, or click to choose"
      check={(file) => {
        const contentType = referenceContentType(file);
        const problem = validateReferenceFile({ contentType, size: file.size });
        return { contentType, problem: problem && PROBLEM_TEXT[problem] };
      }}
      create={(contentType, size) => createReferenceUpload({ principleId, contentType, size })}
      confirm={(key, contentType, title) => confirmReferenceUpload({ principleId, key, contentType, title })}
    />
  );
}

/**
 * Drop or pick files; each one goes straight to R2 through a signed link, one
 * at a time, then `confirm` records it.
 */
export function MediaUploader({
  accept,
  label,
  check,
  create,
  confirm,
}: {
  accept: readonly string[];
  label: string;
  /** The type to store the file under, and what is wrong with it (null when nothing). */
  check: (file: File) => { contentType: string; problem: string | null };
  create: (contentType: string, size: number) => Promise<{ key: string; uploadUrl: string }>;
  confirm: (key: string, contentType: string, title: string) => Promise<void>;
}) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [over, setOver] = useState(false);
  const queue = useRef(Promise.resolve());

  function patch(id: string, change: Partial<Upload>) {
    setUploads((all) => all.map((u) => (u.id === id ? { ...u, ...change } : u)));
  }

  async function upload(file: File, contentType: string, id: string) {
    try {
      const { key, uploadUrl } = await create(contentType, file.size);
      await putFile(uploadUrl, file, contentType, (progress) => patch(id, { progress }));
      await confirm(key, contentType, titleFromFileName(file.name));
      setUploads((all) => all.filter((u) => u.id !== id));
    } catch (error) {
      patch(id, { error: error instanceof Error ? error.message : "Upload failed" });
    }
  }

  function add(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      const id = crypto.randomUUID();
      const { contentType, problem } = check(file);
      setUploads((all) => [...all, { id, name: file.name, progress: 0, error: problem }]);
      if (!problem) queue.current = queue.current.then(() => upload(file, contentType, id));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setOver(false);
          add(event.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border border-dashed px-3 py-4 text-center text-sm ${
          over ? "border-accent text-foreground" : "border-line text-muted hover:border-accent"
        }`}
      >
        <span>{label}</span>
        <span className="text-xs">Up to 200 MB each · MP4 (H.264) plays everywhere</span>
        <input
          type="file"
          multiple
          accept={accept.join(",")}
          className="sr-only"
          onChange={(event) => {
            add(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {uploads.map((u) => (
        <div key={u.id} className="flex items-center gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate">{u.name}</span>
          {u.error ? (
            <>
              <span className="text-red-600">{u.error}</span>
              <button
                type="button"
                className="text-muted hover:underline"
                onClick={() => setUploads((all) => all.filter((x) => x.id !== u.id))}
              >
                Dismiss
              </button>
            </>
          ) : (
            <span className="w-24 overflow-hidden rounded-full bg-line">
              <span className="block h-1 bg-accent transition-[width]" style={{ width: `${u.progress * 100}%` }} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function putFile(url: string, file: File, contentType: string, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.send(file);
  });
}
