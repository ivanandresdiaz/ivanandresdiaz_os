"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { describeDeletion, type DeletionImpact } from "@/domain/deletion";
import { deletionImpact } from "@/server/actions";

/** Events stop here, so the dialog never starts a drag or closes the drawer it opened from. */
const keep = {
  onPointerDown: (event: React.SyntheticEvent) => event.stopPropagation(),
  onClick: (event: React.SyntheticEvent) => event.stopPropagation(),
  onKeyDown: (event: React.SyntheticEvent) => event.stopPropagation(),
};

/**
 * A delete button that asks first. The dialog names what goes and, for things
 * that hold others (`counts`), how many go with it. Focus starts on Cancel, so
 * Enter or Escape never deletes; only the red Delete does.
 */
export function ConfirmDelete({
  action,
  id,
  what,
  title,
  counts,
  className = "text-muted hover:text-red-600",
  buttonTitle,
  children = "×",
}: {
  /** The server action; it gets a FormData with `id`. */
  action: (fd: FormData) => Promise<void>;
  id: string;
  /** What it is, for the question: "Move", "Task", "Step"... */
  what: string;
  title: string;
  /** What to count before asking, for things that hold others. */
  counts?: Parameters<typeof deletionImpact>[0]["kind"];
  className?: string;
  buttonTitle?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        {...keep}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={className}
        title={buttonTitle ?? `Delete ${what}`}
        aria-label={`Delete ${title}`}
      >
        {children}
      </button>
      {open && (
        <ConfirmDeleteDialog
          action={action}
          id={id}
          what={what}
          title={title}
          counts={counts}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ConfirmDeleteDialog({
  action,
  id,
  what,
  title,
  counts,
  onClose,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  what: string;
  title: string;
  counts?: Parameters<typeof deletionImpact>[0]["kind"];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [impact, setImpact] = useState<DeletionImpact | null>(counts ? null : {});
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
    cancel.current?.focus();
  }, []);

  useEffect(() => {
    if (!counts) return;
    let live = true;
    deletionImpact({ kind: counts, id })
      .then((found) => live && setImpact(found))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [counts, id]);

  function confirm() {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await action(fd);
      dialog.current?.close();
    });
  }

  const goesWith = impact && describeDeletion(impact);

  return (
    <div className="contents" {...keep}>
      <dialog
        ref={dialog}
        role="alertdialog"
        aria-label={`Delete ${title}?`}
        onClose={onClose}
        onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <div className="flex flex-col gap-3 p-4 text-sm">
          <h2 className="font-semibold">
            Delete the {what} <span className="break-words">“{title}”</span>?
          </h2>
          {counts && !impact && !failed && <p className="text-muted">Checking what goes with it…</p>}
          {failed && <p className="text-muted">Everything it holds goes with it.</p>}
          {goesWith && <p>{goesWith}</p>}
          <p className="text-xs text-muted">This can&apos;t be undone.</p>
          <div className="flex items-center justify-end gap-2">
            <button ref={cancel} type="button" className="btn" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button
              type="button"
              className="btn border-red-600 bg-red-600 text-white hover:bg-red-700"
              disabled={pending || (counts !== undefined && !impact && !failed)}
              onClick={confirm}
            >
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
