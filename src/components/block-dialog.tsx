"use client";

import { type ReactNode, useEffect, useRef } from "react";
import type { BlockType } from "@/server/queries";

/** The modal where a Block gets its Block type. Escape or a click outside closes it. */
export function BlockDialog({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && dialog.current.close()}
      onKeyDown={(event) => event.key === "Escape" && dialog.current?.close()}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-0 text-foreground backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** The active Block types, grouped in Habit and Container; a click picks one. */
export function BlockTypeChoices({
  types,
  current,
  disabled,
  onChoose,
}: {
  types: BlockType[];
  current?: string;
  disabled: boolean;
  onChoose: (blockTypeId: string) => void;
}) {
  const active = types.filter((t) => !t.archived);
  if (active.length === 0) {
    return <p className="text-sm text-muted">No active Block types. Create one under Block types first.</p>;
  }
  return (["habit", "container"] as const).map((kind) => {
    const list = active.filter((t) => t.kind === kind);
    if (list.length === 0) return null;
    return (
      <div key={kind} className="flex flex-col gap-1.5">
        <h3 className="text-xs text-muted">{kind === "habit" ? "Habit" : "Container"}</h3>
        <div className="flex flex-wrap gap-1.5">
          {list.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => onChoose(t.id)}
              className={`btn ${current === t.id ? "border-accent" : ""}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
              {t.name}
            </button>
          ))}
        </div>
      </div>
    );
  });
}
