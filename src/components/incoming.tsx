"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { AddClipResult } from "@/server/clip-actions";
import { deleteClip, downloadClip } from "@/server/clip-actions";
import type { ClipView } from "@/server/clips";
import { DownloadStatus } from "./clips";
import { ConfirmDelete } from "./confirm-delete";

/** How often the page looks again while a pasted link downloads, or waits for the computer. */
const POLL_MS = 5000;
const WAITING_POLL_MS = 30_000;

/**
 * A link pasted where its content will live (a Creator or a Principle). It
 * downloads by itself and lands here; it never goes through the Clips bank.
 */
export function PasteLink({ paste }: { paste: (link: string) => Promise<AddClipResult> }) {
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (!link.trim()) return;
        startTransition(async () => {
          const result = await paste(link.trim());
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
          aria-label="Paste a link"
          placeholder="Paste a reel or YouTube link"
          className="input min-w-0 flex-1 py-1 text-sm"
        />
        <button className="btn text-sm disabled:opacity-50" disabled={pending || !link.trim()}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      {message && (
        <p aria-live="polite" className="text-xs text-red-600">
          {message}
        </p>
      )}
    </form>
  );
}

/** The links on their way here: downloading, waiting for the computer, or failed with Retry. */
export function IncomingList({ incoming }: { incoming: ClipView[] }) {
  const router = useRouter();
  const downloading = incoming.some((clip) => clip.status === "downloading" || clip.status === "ready");
  const waiting = incoming.some((clip) => clip.status === "waiting");

  // Nothing tells the page a download ended, so it looks again until each one lands.
  useEffect(() => {
    if (!downloading && !waiting) return;
    const timer = window.setInterval(() => router.refresh(), downloading ? POLL_MS : WAITING_POLL_MS);
    return () => window.clearInterval(timer);
  }, [downloading, waiting, router]);

  if (incoming.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {incoming.map((clip) => (
        <IncomingRow key={clip.id} clip={clip} />
      ))}
    </ul>
  );
}

function IncomingRow({ clip }: { clip: ClipView }) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-start gap-2 rounded-md border border-dashed border-line p-2">
      <span
        aria-hidden
        className="flex aspect-[9/16] w-10 shrink-0 items-center justify-center rounded bg-line text-[10px] text-muted"
      >
        {clip.source === "instagram" ? "Reel" : "Video"}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <a
          href={clip.url}
          target="_blank"
          rel="noreferrer"
          className="truncate text-sm hover:text-accent"
          title={clip.title}
        >
          {clip.title}
        </a>
        {clip.status === "ready" ? (
          <p className="text-xs text-muted">Arriving…</p>
        ) : (
          <DownloadStatus
            clip={clip}
            computerCheckedAt={clip.computerCheckedAt ?? null}
            pending={pending}
            onDownload={() => startTransition(() => downloadClip({ id: clip.id }))}
          />
        )}
      </div>
      <ConfirmDelete action={deleteClip} id={clip.id} what="link" title={clip.title} />
    </li>
  );
}
