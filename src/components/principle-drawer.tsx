"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updatePrinciple } from "@/server/actions";
import type { PrincipleView } from "@/server/queries";
import { Markdown } from "./markdown";
import { ReferenceStrip, ReferenceUploader } from "./references";
import { StoryViewer } from "./story-viewer";

type Mode = "preview" | "edit";

export function PrincipleDrawer({
  principle,
  initialMode = "preview",
  onClose,
}: {
  principle: PrincipleView | null;
  initialMode?: Mode;
  onClose: () => void;
}) {
  if (!principle) return null;
  return <Drawer key={principle.id} principle={principle} initialMode={initialMode} onClose={onClose} />;
}

function Drawer({
  principle,
  initialMode,
  onClose,
}: {
  principle: PrincipleView;
  initialMode: Mode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [title, setTitle] = useState(principle.title);
  const [body, setBody] = useState(principle.body);
  const [saving, startSaving] = useTransition();
  const [story, setStory] = useState<number | null>(null);
  const dirty = title !== principle.title || body !== principle.body;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function discardIfConfirmed() {
    if (!dirty) return true;
    if (!window.confirm("Discard the unsaved changes to this Principle?")) return false;
    setTitle(principle.title);
    setBody(principle.body);
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
    if (!dirty || title.trim() === "") return;
    const fd = new FormData();
    fd.set("id", principle.id);
    fd.set("title", title);
    fd.set("body", body);
    startSaving(async () => {
      await updatePrinciple(fd);
      setTitle(title.trim());
      setBody(body.trim());
      setMode("preview");
    });
  }

  return (
    <dialog
      ref={dialog}
      aria-label={principle.title}
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
          <h2 className="min-w-0 flex-1 truncate font-semibold">{principle.title}</h2>
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
          <ReferenceStrip
            principleId={principle.id}
            references={principle.references}
            editing={mode === "edit"}
            onOpen={setStory}
          />
          {mode === "edit" && <ReferenceUploader principleId={principle.id} />}
          {mode === "preview" ? (
            body.trim() ? (
              <Markdown>{body}</Markdown>
            ) : (
              <p className="text-sm text-muted">No Expansion yet. Switch to Edit to write one.</p>
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
                aria-label="Title"
                className="input font-medium"
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between">
                  <span className="label">Expansion</span>
                  <span className="text-xs text-muted">Markdown</span>
                </div>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  autoFocus
                  aria-label="Expansion"
                  placeholder="Explain it, give examples, link the videos that carry it."
                  className="input min-h-64 font-mono leading-relaxed field-sizing-content"
                />
              </div>
              <div className="flex items-center gap-3">
                <button className="btn" disabled={!dirty || saving || title.trim() === ""}>
                  {saving ? "Saving…" : "Save"}
                </button>
                {dirty && !saving && <span className="text-xs text-muted">Unsaved changes</span>}
              </div>
            </form>
          )}
        </div>
      </div>
      {story !== null && (
        <StoryViewer
          principleTitle={principle.title}
          references={principle.references}
          startIndex={story}
          onClose={() => setStory(null)}
        />
      )}
    </dialog>
  );
}
