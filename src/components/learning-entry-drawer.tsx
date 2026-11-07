"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addLearningEntry, updateLearningEntry } from "@/server/actions";
import { LongText } from "./long-text";
import { Markdown } from "./markdown";

type Mode = "preview" | "edit";

/** What the drawer is open on: a saved Learning entry, or a new one being captured on `date`. */
export type LearningDrawerTarget =
  | { kind: "entry"; id: string; title: string; expansion: string }
  | { kind: "new"; date: string; title: string };

/**
 * The room a Learning entry gets when one line is not enough: its title and its
 * Expansion. It reads the Expansion when there is one and writes it otherwise.
 * `readOnly` (the Weekly Review) only reads.
 */
export function LearningEntryDrawer({
  target,
  readOnly = false,
  onClose,
}: {
  target: LearningDrawerTarget | null;
  readOnly?: boolean;
  onClose: () => void;
}) {
  if (!target) return null;
  const key = target.kind === "entry" ? target.id : `new-${target.date}`;
  return <Drawer key={key} target={target} readOnly={readOnly} onClose={onClose} />;
}

function Drawer({
  target,
  readOnly,
  onClose,
}: {
  target: LearningDrawerTarget;
  readOnly: boolean;
  onClose: () => void;
}) {
  const saved = { title: target.title, expansion: target.kind === "entry" ? target.expansion : "" };
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>(
    readOnly || (target.kind === "entry" && saved.expansion.trim() !== "") ? "preview" : "edit",
  );
  const [title, setTitle] = useState(saved.title);
  const [expansion, setExpansion] = useState(saved.expansion);
  const [saving, startSaving] = useTransition();
  const dirty = target.kind === "new" ? title.trim() !== "" || expansion.trim() !== "" : title !== saved.title || expansion !== saved.expansion;
  const canSave = title.trim() !== "" && (target.kind === "new" || dirty);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function discardIfConfirmed() {
    if (!dirty || readOnly) return true;
    if (!window.confirm("Discard the unsaved changes to this Learning entry?")) return false;
    setTitle(saved.title);
    setExpansion(saved.expansion);
    return true;
  }

  function requestClose() {
    if (discardIfConfirmed()) onClose();
  }

  function switchTo(next: Mode) {
    if (next === mode) return;
    if (next === "preview" && !discardIfConfirmed()) return;
    setMode(next);
  }

  function save() {
    if (!canSave || saving) return;
    const fd = new FormData();
    fd.set("title", title);
    fd.set("expansion", expansion);
    if (target.kind === "entry") fd.set("id", target.id);
    else fd.set("date", target.date);
    startSaving(async () => {
      if (target.kind === "new") {
        await addLearningEntry(fd);
        onClose();
        return;
      }
      await updateLearningEntry(fd);
      setTitle(title.trim());
      setExpansion(expansion.trim());
      setMode("preview");
    });
  }

  const heading = target.kind === "new" ? "New Learning entry" : saved.title;

  return (
    <dialog
      ref={dialog}
      aria-label={heading}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && requestClose()}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[560px] translate-x-0 border-l border-line bg-surface p-0 text-foreground transition-transform duration-200 ease-out backdrop:bg-black/40 starting:translate-x-full motion-reduce:transition-none"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <h2 className="min-w-0 flex-1 truncate font-semibold">{heading}</h2>
          {!readOnly && target.kind === "entry" && (
            <div role="group" aria-label="Mode" className="flex rounded-md border border-line p-0.5 text-sm">
              {(["preview", "edit"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => switchTo(m)}
                  className={`rounded px-2 py-0.5 capitalize ${mode === m ? "bg-line text-foreground" : "text-muted hover:text-foreground"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            title="Close"
            className="text-lg leading-none text-muted hover:text-foreground"
          >
            ×
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {mode === "preview" ? (
            expansion.trim() ? (
              <Markdown>{expansion}</Markdown>
            ) : (
              <p className="text-sm text-muted">
                {readOnly ? "No Expansion." : "No Expansion yet. Switch to Edit to write one."}
              </p>
            )
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "s") {
                  event.preventDefault();
                  save();
                }
              }}
            >
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={1000}
                autoFocus={title.trim() === ""}
                placeholder="What am I learning?"
                aria-label="Title"
                className="input font-medium"
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between">
                  <span className="label">Expansion</span>
                  <span className="text-xs text-muted">Markdown</span>
                </div>
                <LongText
                  value={expansion}
                  onValueChange={setExpansion}
                  autoFocus={title.trim() !== ""}
                  markdown
                  aria-label="Expansion"
                  placeholder="Explain it, reflect on it, say why it matters."
                  className="input min-h-64 font-mono leading-relaxed"
                />
              </div>
              <div className="flex items-center gap-3">
                <button className="btn" disabled={!canSave || saving}>
                  {saving ? "Saving…" : target.kind === "new" ? "Add" : "Save"}
                </button>
                {dirty && !saving && target.kind === "entry" && <span className="text-xs text-muted">Unsaved changes</span>}
              </div>
            </form>
          )}
        </div>
      </div>
    </dialog>
  );
}
