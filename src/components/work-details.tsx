"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { linkLabel } from "@/domain/links";
import { createLink, deleteLink, reorderLinks, setDescription, updateLink } from "@/server/actions";
import type { LinkView } from "@/server/queries";
import { LongText } from "./long-text";
import { Markdown } from "./markdown";
import { DrawerFrame, SaveForm, useEditMode } from "./plan-drawers";
import { Hidden } from "./ui";

/** The Task or Move that owns a Description and Links. */
export type DetailOwner = { kind: "task" | "move"; id: string; title: string };

const KIND_LABEL = { task: "Task", move: "Move" } as const;

/** The small mark that says some work has a Description or Links (calendar, Stack). */
export function DetailsMark() {
  return (
    <span className="ml-1 text-muted" title="Has a Description or Links" aria-label="Has a Description or Links">
      ≡
    </span>
  );
}

/** The ≡ beside a title: opens the Description. Shown only when there is one. */
export function DescriptionButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Description"
      aria-label={`Description of ${title}`}
      className="-my-0.5 flex size-6 shrink-0 items-center justify-center rounded-md leading-none text-muted hover:bg-line hover:text-foreground"
    >
      ≡
    </button>
  );
}

/**
 * The + of a Task or a Move: a short menu of what it can take. Nothing is there
 * until it is asked for; the Description leaves the menu once it exists.
 */
export function AddMenu({
  label,
  options,
}: {
  label: string;
  options: { label: string; onSelect: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="-my-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-lg leading-none text-muted hover:bg-line hover:text-foreground"
      >
        +
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 flex min-w-36 flex-col rounded-md border border-line bg-surface p-1 text-sm shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                option.onSelect();
              }}
              className="rounded px-2 py-1.5 text-left hover:bg-background"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The Description of a Task or a Move, to read or edit in the side drawer. A new one opens in Edit. */
export function DescriptionDrawer({
  owner,
  description: saved,
  onClose,
}: {
  owner: DetailOwner;
  description: string;
  onClose: () => void;
}) {
  const [text, setText] = useState(saved);
  const [saving, startSaving] = useTransition();
  const dirty = text.trim() !== saved.trim();
  const { mode, setMode, switchTo, confirmDiscard } = useEditMode(dirty, () => setText(saved), saved ? "preview" : "edit");
  const editor = useRef<HTMLDivElement>(null);

  // Opening the dialog focuses its first button; a new Description starts in its text instead.
  useEffect(() => {
    if (mode !== "edit") return;
    const frame = requestAnimationFrame(() => editor.current?.querySelector("textarea")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  function save() {
    if (!dirty) return;
    startSaving(async () => {
      await setDescription({ kind: owner.kind, id: owner.id, description: text });
      setText(text.trim());
      // Emptied: there is no Description left to read.
      if (text.trim() === "") onClose();
      else setMode("preview");
    });
  }

  return (
    <DrawerFrame
      heading={owner.title}
      subheading={`${KIND_LABEL[owner.kind]} · Description`}
      mode={mode}
      onSwitch={switchTo}
      onRequestClose={() => confirmDiscard() && onClose()}
      onClose={onClose}
    >
      {mode === "preview" ? (
        text.trim() ? (
          <Markdown>{text}</Markdown>
        ) : (
          <p className="text-sm text-muted">No Description yet.</p>
        )
      ) : (
        <SaveForm onSave={save} dirty={dirty} saving={saving} canSave>
          <div ref={editor} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="label">Description</span>
              <span className="text-xs text-muted">Markdown</span>
            </div>
            <LongText
              value={text}
              onValueChange={setText}
              markdown
              aria-label="Description"
              placeholder="What to know to do it: the context, the approach, the ideas…"
              className="input min-h-72 leading-relaxed"
            />
          </div>
        </SaveForm>
      )}
    </DrawerFrame>
  );
}

/**
 * The Links of a Task or a Move: one line each, opened in a new tab. ✎ edits
 * one, ↑ moves it up, × removes it.
 */
export function LinkList({ links, className = "" }: { links: LinkView[]; className?: string }) {
  const [shown, setShown] = useOptimistic(links);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  if (shown.length === 0) return null;

  function moveUp(index: number) {
    const next = [...shown];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    startTransition(async () => {
      setShown(next);
      await reorderLinks({ ids: next.map((l) => l.id) });
    });
  }

  return (
    <ul className={`flex flex-col gap-0.5 text-sm ${className}`} aria-label="Links">
      {shown.map((link, index) =>
        editing === link.id ? (
          <li key={link.id}>
            <LinkForm link={link} onDone={() => setEditing(null)} />
          </li>
        ) : (
          <li key={link.id} className="group/link flex min-w-0 items-center gap-1.5">
            <span aria-hidden="true" className="text-muted">
              ↗
            </span>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={link.url}
              className="min-w-0 truncate text-accent underline-offset-2 hover:underline"
            >
              {linkLabel(link)}
            </a>
            <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted opacity-0 group-hover/link:opacity-100 group-focus-within/link:opacity-100 pointer-coarse:opacity-100">
              {index > 0 && (
                <button type="button" onClick={() => moveUp(index)} title="Move up" aria-label={`Move ${linkLabel(link)} up`} className="hover:text-foreground">
                  ↑
                </button>
              )}
              <button type="button" onClick={() => setEditing(link.id)} title="Edit Link" aria-label={`Edit ${linkLabel(link)}`} className="hover:text-foreground">
                ✎
              </button>
              <form action={deleteLink}>
                <Hidden id={link.id} />
                <button title="Delete Link" aria-label={`Delete ${linkLabel(link)}`} className="hover:text-red-600">
                  ×
                </button>
              </form>
            </span>
          </li>
        ),
      )}
    </ul>
  );
}

/** Adds a Link to its owner, or edits one: the address, and a title if wanted. */
export function LinkForm({
  owner,
  link,
  onDone,
}: {
  owner?: Pick<DetailOwner, "kind" | "id">;
  link?: LinkView;
  onDone: () => void;
}) {
  const [url, setUrl] = useState(link?.url ?? "");
  const [title, setTitle] = useState(link?.title ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        startSaving(async () => {
          const result = link
            ? await updateLink({ id: link.id, url, title })
            : await createLink({ kind: owner!.kind, id: owner!.id, url, title });
          if (result.ok) onDone();
          else setError(result.error);
        });
      }}
      onKeyDown={(event) => event.key === "Escape" && onDone()}
    >
      <div className="flex flex-wrap gap-1.5">
        <input
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
          }}
          required
          autoFocus
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Paste a link"
          aria-label="Link address"
          aria-invalid={error ? true : undefined}
          className="input min-w-40 flex-1 text-xs"
        />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title (optional)"
          aria-label="Link title"
          className="input min-w-32 flex-1 text-xs"
        />
      </div>
      <div className="flex items-center gap-2">
        <button className="btn text-xs" disabled={saving || url.trim() === ""}>
          {link ? "Save" : "Add Link"}
        </button>
        <button type="button" className="text-xs text-muted hover:text-foreground" onClick={onDone}>
          Cancel
        </button>
        {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </form>
  );
}
