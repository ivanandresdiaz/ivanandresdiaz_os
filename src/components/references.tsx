"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import {
  ACCEPTED_REFERENCE_TYPES,
  moveItem,
  TILE_PREVIEW_SECONDS,
  validateReferenceFile,
  type ReferenceFileProblem,
} from "@/domain/references";
import { confirmReferenceUpload, createReferenceUpload, deleteReference, reorderReferences } from "@/server/actions";
import type { ReferenceView } from "@/server/queries";

const TILE_MIME = "application/x-ivan-reference";

const PROBLEM_TEXT: Record<ReferenceFileProblem, string> = {
  "unsupported-type": "Only JPG, PNG, WebP, GIF, MP4, WebM or MOV.",
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

  return (
    <div className="-mx-4 flex shrink-0 gap-2 overflow-x-auto px-4 pb-1">
      {shown.map((reference, i) => (
        <div
          key={reference.id}
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
          className={`relative aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-lg bg-line ${
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
        </div>
      ))}
    </div>
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
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [over, setOver] = useState(false);
  const queue = useRef(Promise.resolve());

  function patch(id: string, change: Partial<Upload>) {
    setUploads((all) => all.map((u) => (u.id === id ? { ...u, ...change } : u)));
  }

  async function upload(file: File, id: string) {
    try {
      const { key, uploadUrl } = await createReferenceUpload({ principleId, contentType: file.type, size: file.size });
      await putFile(uploadUrl, file, (progress) => patch(id, { progress }));
      await confirmReferenceUpload({ principleId, key, contentType: file.type });
      setUploads((all) => all.filter((u) => u.id !== id));
    } catch (error) {
      patch(id, { error: error instanceof Error ? error.message : "Upload failed" });
    }
  }

  function add(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      const id = crypto.randomUUID();
      const problem = validateReferenceFile({ contentType: file.type, size: file.size });
      setUploads((all) => [...all, { id, name: file.name, progress: 0, error: problem && PROBLEM_TEXT[problem] }]);
      if (!problem) queue.current = queue.current.then(() => upload(file, id));
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
        <span>Drop images or videos, or click to choose</span>
        <span className="text-xs">Up to 200 MB each · MP4 (H.264) plays everywhere</span>
        <input
          type="file"
          multiple
          accept={ACCEPTED_REFERENCE_TYPES.join(",")}
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

function putFile(url: string, file: File, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.send(file);
  });
}
