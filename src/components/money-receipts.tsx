"use client";

import { useRef, useState } from "react";
import { isPicture, MAX_RECEIPTS, receiptContentType, receiptProblem } from "@/domain/receipts";
import { createReceiptUpload, discardReceiptUploads } from "@/server/money-actions";
import type { ReceiptView } from "@/server/money";

type Staged = {
  id: number;
  name: string;
  contentType: string;
  key: string | null;
  state: "uploading" | "ready" | "failed";
  message?: string;
};

let nextStaged = 0;

/**
 * The Receipts of a movement while its form is open. New files upload at once
 * and attach when the movement is saved; taking one off happens on save too.
 */
export function useReceipts(initial: ReceiptView[] = []) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [staged, setStaged] = useState<Staged[]>([]);
  const saved = useRef(false);
  // Mirrors `staged` for the dialog's close, which runs outside a render.
  const latest = useRef<Staged[]>([]);

  function update(next: Staged[] | ((list: Staged[]) => Staged[])) {
    setStaged((list) => {
      const value = typeof next === "function" ? next(list) : next;
      latest.current = value;
      return value;
    });
  }

  async function add(file: File) {
    const id = ++nextStaged;
    const contentType = receiptContentType(file);
    const set = (patch: Partial<Staged>) => update((list) => list.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    const problem = receiptProblem({ contentType, size: file.size });
    update((list) => [
      ...list,
      { id, name: file.name || "Receipt", contentType, key: null, state: problem ? "failed" : "uploading", message: problem ?? undefined },
    ]);
    if (problem) return;
    try {
      const upload = await createReceiptUpload({ contentType, size: file.size });
      if ("error" in upload) return set({ state: "failed", message: upload.error });
      const res = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      if (!res.ok) {
        void discardReceiptUploads({ keys: [upload.key] }).catch(() => {});
        return set({ state: "failed", message: "It didn't upload. Try again." });
      }
      set({ key: upload.key, state: "ready" });
    } catch {
      set({ state: "failed", message: "It didn't upload. Try again." });
    }
  }

  function drop(id: number) {
    const file = latest.current.find((f) => f.id === id);
    if (file?.key) void discardReceiptUploads({ keys: [file.key] }).catch(() => {});
    update((list) => list.filter((f) => f.id !== id));
  }

  function toggleRemove(id: string) {
    setRemoved((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ready = staged.filter((f) => f.state === "ready" && f.key);
  return {
    initial,
    removed,
    staged,
    add,
    drop,
    toggleRemove,
    uploading: staged.some((f) => f.state === "uploading"),
    room: MAX_RECEIPTS - (initial.length - removed.size) - staged.filter((f) => f.state !== "failed").length,
    /** What saveMovement attaches and takes off. */
    payload: () => ({
      add: ready.map((f) => ({ key: f.key!, name: f.name, contentType: f.contentType })),
      remove: [...removed],
    }),
    markSaved: () => {
      saved.current = true;
    },
    /** On closing without saving: the new uploads are deleted. */
    discardUnsaved: () => {
      if (saved.current) return;
      const keys = latest.current.flatMap((f) => (f.key ? [f.key] : []));
      if (keys.length > 0) void discardReceiptUploads({ keys }).catch(() => {});
    },
  };
}

export type ReceiptsState = ReturnType<typeof useReceipts>;

export function ReceiptsField({ receipts }: { receipts: ReceiptsState }) {
  const input = useRef<HTMLInputElement>(null);
  const { initial, removed, staged } = receipts;
  return (
    <div className="flex flex-col gap-2">
      <span className="label">Receipts</span>
      {initial.map((r) => {
        const off = removed.has(r.id);
        return (
          <div key={r.id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-sm">
            <ReceiptThumb receipt={r} />
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className={`min-w-0 flex-1 truncate underline-offset-2 hover:underline ${off ? "text-muted line-through" : ""}`}
            >
              {r.name}
            </a>
            <button type="button" className="text-xs text-muted underline" onClick={() => receipts.toggleRemove(r.id)}>
              {off ? "Keep" : "Remove"}
            </button>
          </div>
        );
      })}
      {staged.map((f) => (
        <div
          key={f.id}
          className={`flex flex-col gap-0.5 rounded-lg border px-2 py-1.5 text-sm ${
            f.state === "failed" ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "border-line"
          }`}
        >
          <span className="flex items-center gap-2">
            <FileIcon pdf={f.contentType === "application/pdf"} />
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            <span className="text-xs text-muted">
              {f.state === "uploading" ? "Uploading…" : f.state === "ready" ? "✓ Attaches on save" : ""}
            </span>
            <button type="button" className="text-xs text-muted" aria-label={`Take off ${f.name}`} onClick={() => receipts.drop(f.id)}>
              ✕
            </button>
          </span>
          {f.message && <span className="text-xs text-amber-900 dark:text-amber-200">{f.message}</span>}
        </div>
      ))}
      {receipts.room > 0 && (
        <label className="flex min-h-10 cursor-pointer items-center gap-2 self-start rounded-full border border-dashed border-line px-4 text-sm text-muted transition hover:border-accent hover:text-accent">
          <ClipIcon />
          Attach photo or PDF
          <input
            ref={input}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])].slice(0, receipts.room);
              event.target.value = "";
              files.forEach((file) => void receipts.add(file));
            }}
          />
        </label>
      )}
    </div>
  );
}

function ReceiptThumb({ receipt }: { receipt: ReceiptView }) {
  if (isPicture(receipt.contentType)) {
    // eslint-disable-next-line @next/next/no-img-element -- a signed R2 link, not an optimizable asset
    return <img src={receipt.url} alt="" className="size-9 shrink-0 rounded object-cover" />;
  }
  return <FileIcon pdf={receipt.contentType === "application/pdf"} />;
}

export function ClipIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" strokeLinecap="round" />
    </svg>
  );
}

function FileIcon({ pdf }: { pdf: boolean }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded bg-background text-[10px] font-semibold text-muted">
      {pdf ? "PDF" : "IMG"}
    </span>
  );
}
