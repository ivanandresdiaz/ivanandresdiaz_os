"use client";

import { useRef, useState, useTransition } from "react";
import { confirmAttachment, createAttachmentUpload, removeAttachment } from "@/server/stakeholder-actions";
import type { Copy } from "./copy";

export type PendingFile = { id: string; name: string; contentType: string };

type Checked = { id: number; name: string; state: "checking" | "rejected" | "failed"; message?: string };

let nextCheck = 0;

/** Photos are shrunk in the browser: a phone photo becomes a JPEG of at most 2000 px. */
async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/jpeg", 0.85),
  );
}

/**
 * Attaching a PDF or a photo (Q53): a warning first, then the AI checks it for
 * client data; a rejected file is deleted at once and the reason shows (Q32).
 */
export function Attachments({
  slug,
  interviewId,
  copy,
  pending,
}: {
  slug: string;
  interviewId: string;
  copy: Copy;
  /** Checked files waiting to go with the next send. */
  pending: PendingFile[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [checks, setChecks] = useState<Checked[]>([]);
  const [removing, startRemoving] = useTransition();

  async function add(file: File) {
    const id = ++nextCheck;
    setChecks((list) => [...list, { id, name: file.name, state: "checking" }]);
    const update = (next: Partial<Checked>) => setChecks((list) => list.map((c) => (c.id === id ? { ...c, ...next } : c)));
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const body: Blob = isPdf ? file : await shrinkPhoto(file).catch(() => file);
      const contentType = isPdf ? "application/pdf" : body.type || file.type;
      const upload = await createAttachmentUpload({ slug, interviewId, contentType, size: body.size });
      if (!upload.ok) return update({ state: "failed", message: copy.fileErrors[upload.error] ?? upload.error });
      const res = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body });
      if (!res.ok) return update({ state: "failed", message: copy.fileErrors.upload });
      const result = await confirmAttachment({ slug, interviewId, key: upload.key, contentType, name: file.name });
      if (!result.ok) return update({ state: "failed", message: copy.fileErrors[result.error] ?? result.error });
      if (!result.accepted) return update({ state: "rejected", message: result.reason });
      // Accepted: it now shows among the pending files the page brings.
      setChecks((list) => list.filter((c) => c.id !== id));
    } catch {
      update({ state: "failed", message: copy.fileErrors.upload });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {pending.map((file) => (
        <div key={file.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
          <FileIcon pdf={file.contentType === "application/pdf"} />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="text-xs text-accent">✓ {copy.willSend}</span>
          <button
            type="button"
            disabled={removing}
            onClick={() => startRemoving(() => removeAttachment({ slug, interviewId, fileId: file.id }))}
            className="text-xs text-muted underline"
          >
            {copy.removeFile}
          </button>
        </div>
      ))}
      {checks.map((c) => (
        <div
          key={c.id}
          className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-sm ${
            c.state === "checking" ? "border-line bg-surface" : "border-amber-300 bg-amber-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            <span className="text-xs text-muted">
              {c.state === "checking" ? copy.checking : c.state === "rejected" ? copy.rejected : "!"}
            </span>
            {c.state !== "checking" && (
              <button
                type="button"
                className="text-xs text-muted"
                aria-label={copy.removeFile}
                onClick={() => setChecks((list) => list.filter((x) => x.id !== c.id))}
              >
                ✕
              </button>
            )}
          </span>
          {c.message && <span className="text-xs text-amber-900">{c.message}</span>}
        </div>
      ))}
      <label className="flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-full border border-dashed border-line px-4 text-sm text-muted transition hover:border-accent hover:text-accent">
        <ClipIcon />
        {copy.attach}
        <input
          ref={input}
          type="file"
          accept="application/pdf,image/*"
          className="sr-only"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            files.forEach((file) => void add(file));
          }}
        />
      </label>
      <p className="text-xs text-muted">{copy.attachHint}</p>
    </div>
  );
}

function ClipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon({ pdf }: { pdf: boolean }) {
  return <span className="rounded bg-line px-1.5 py-0.5 text-[10px] font-semibold text-muted">{pdf ? "PDF" : "IMG"}</span>;
}
